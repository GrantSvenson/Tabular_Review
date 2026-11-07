import json
import os
import unittest
from unittest.mock import patch, AsyncMock

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
import openrouter


class OpenRouterTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(openrouter.router)
        self.client = TestClient(app)
        self.request = {"model": "openai/gpt-4.1-mini", "messages": [{"role": "user", "content": "Find fee"}]}
        self.key_patch = patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-secret"})
        self.key_patch.start()
        self.addCleanup(self.key_patch.stop)

    def transport(self, handler):
        real_client = httpx.AsyncClient
        return patch.object(openrouter.httpx, "AsyncClient", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))

    def test_authentication_schema_and_content(self):
        self.request["response_format"] = {"type": "json_schema", "json_schema": {"name": "extraction", "strict": True, "schema": {"type": "object"}}}

        def handler(request):
            self.assertEqual(str(request.url), openrouter.OPENROUTER_URL)
            self.assertEqual(request.headers["Authorization"], "Bearer test-secret")
            body = json.loads(request.content)
            self.assertEqual(body["provider"], {"require_parameters": True})
            self.assertEqual(body["response_format"]["json_schema"]["schema"], {"type": "object"})
            return httpx.Response(200, json={"choices": [{"message": {"content": '{"value":"50"}'}}]})

        with self.transport(handler):
            response = self.client.post('/ai/chat', json=self.request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"content": '{"value":"50"}'})
        self.assertNotIn('test-secret', response.text)

    def test_missing_key_does_not_contact_openrouter(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": ""}), patch.object(openrouter.httpx, "AsyncClient") as upstream:
            response = self.client.post('/ai/chat', json=self.request)
            upstream.assert_not_called()
        self.assertEqual(response.status_code, 503)
        self.assertIn('OPENROUTER_API_KEY', response.json()['detail'])

    def test_provider_error_is_actionable_and_redacted(self):
        with self.transport(lambda request: httpx.Response(401, json={"error": {"message": "Invalid key test-secret"}})):
            response = self.client.post('/ai/chat', json=self.request)
        self.assertEqual(response.status_code, 401)
        self.assertIn('Invalid key', response.text)
        self.assertNotIn('test-secret', response.text)

    def test_rate_limits_retry_and_then_succeed(self):
        attempts = []

        def handler(request):
            attempts.append(request)
            if len(attempts) < 3:
                return httpx.Response(429, json={"error": {"message": "Rate limit"}})
            return httpx.Response(200, json={"choices": [{"message": {"content": "Answer"}}]})

        with self.transport(handler), patch.object(openrouter.asyncio, "sleep", new_callable=AsyncMock):
            response = self.client.post('/ai/chat', json=self.request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(attempts), 3)

    def test_empty_malformed_truncated_and_refused_responses(self):
        for data in [{}, [], {"choices": []}, {"choices": [{"message": {"content": ""}}]},
                     {"choices": [{"message": {"content": "partial"}, "finish_reason": "length"}]},
                     {"choices": [{"message": {"refusal": "Cannot comply"}}]}]:
            with self.subTest(data=data), self.transport(lambda request: httpx.Response(200, json=data)):
                response = self.client.post('/ai/chat', json=self.request)
                self.assertIn(response.status_code, (422, 502))

    def test_timeout_is_reported(self):
        def handler(request):
            raise httpx.ReadTimeout('timeout')
        with self.transport(handler):
            response = self.client.post('/ai/chat', json=self.request)
        self.assertEqual(response.status_code, 504)

    def test_bare_provider_models_are_rejected(self):
        self.request['model'] = 'gemini-2.5-flash'
        self.assertEqual(self.client.post('/ai/chat', json=self.request).status_code, 422)


if __name__ == '__main__':
    unittest.main()
