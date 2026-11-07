import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { analyzeDataWithChat, DEFAULT_MODEL, extractColumnData, generatePromptHelper, normalizeModelId } from '../services/openRouterService.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const doc = { id: 'd1', name: 'Contract.txt', content: btoa(String.fromCharCode(...new TextEncoder().encode('The fee is €50.'))), size: 16, mimeType: 'text/markdown', type: 'txt' };
const column = { id: 'c1', name: 'Fee', prompt: 'Find the fee.', type: 'number' as const, status: 'idle' as const };
const extraction = { value: '50', confidence: 'High', quote: '€50', page: 1, reasoning: 'Stated fee.' };

test('extraction sends UTF-8 text, model and strict JSON schema through the backend without credentials', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:8000/ai/chat');
    assert.equal(options?.signal, controller.signal);
    assert.deepEqual(options?.headers, { 'Content-Type': 'application/json' });
    const body = JSON.parse(options!.body as string);
    assert.equal(body.model, 'openrouter/free');
    assert.match(body.messages[1].content, /€50/);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    return Response.json({ content: JSON.stringify(extraction) });
  };
  assert.deepEqual(await extractColumnData(doc, column, DEFAULT_MODEL, controller.signal), { ...extraction, status: 'needs_review' });
});

test('malformed or incomplete extraction is rejected', async () => {
  for (const content of ['not JSON', '{}', JSON.stringify({ ...extraction, page: 0 }), JSON.stringify({ ...extraction, confidence: 'Certain' })]) {
    globalThis.fetch = async () => Response.json({ content });
    await assert.rejects(extractColumnData(doc, column, DEFAULT_MODEL), /invalid extraction JSON|incomplete extraction data/);
  }
});

test('fabricated supporting quotes are rejected', async () => {
  globalThis.fetch = async () => Response.json({ content: JSON.stringify({ ...extraction, quote: '€100' }) });
  await assert.rejects(extractColumnData(doc, column, DEFAULT_MODEL), /quote was not found/);
});

test('missing keys and provider errors reach the caller', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Add OPENROUTER_API_KEY to .env' }, { status: 503 });
  await assert.rejects(generatePromptHelper('Fee', 'number', undefined, DEFAULT_MODEL), /OPENROUTER_API_KEY/);
});

test('network failures explain how to start the backend', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(generatePromptHelper('Fee', 'number', undefined, DEFAULT_MODEL), /start-backend.sh/);
});

test('prompt helper accepts a custom OpenRouter model without extraction formatting', async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.equal(body.model, 'anthropic/claude-sonnet-4.5');
    assert.equal(body.response_format, undefined);
    assert.match(body.messages[0].content, /Draft prompt: Find fee/);
    return Response.json({ content: 'Extract the stated fee.' });
  };
  assert.equal(await generatePromptHelper('Fee', 'number', 'Find fee', 'anthropic/claude-sonnet-4.5'), 'Extract the stated fee.');
});

test('chat preserves conversation roles and dataset punctuation', async () => {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.deepEqual(body.messages.slice(1), [
      { role: 'user', content: 'What fee?' },
      { role: 'assistant', content: '€50.' },
      { role: 'user', content: 'Compare fees.' },
    ]);
    assert.match(body.messages[0].content, /1,000/);
    return Response.json({ content: 'The fee is 1,000.' });
  };
  await analyzeDataWithChat('Compare fees.', { documents: [doc], columns: [column], results: { d1: { c1: { ...extraction, value: '1,000', confidence: 'High' } } } }, [
    { id: '1', role: 'user', text: 'What fee?', timestamp: 1 },
    { id: '2', role: 'model', text: '€50.', timestamp: 2 },
  ], DEFAULT_MODEL);
});

test('legacy saved model IDs migrate and provider-qualified IDs survive', () => {
  assert.equal(normalizeModelId('gemini-2.5-flash'), DEFAULT_MODEL);
  assert.equal(normalizeModelId(undefined), DEFAULT_MODEL);
  assert.equal(normalizeModelId('anthropic/claude-sonnet-4.5'), 'anthropic/claude-sonnet-4.5');
});
