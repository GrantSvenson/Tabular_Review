# Tabular Review for Bulk Document Analysis

An AI-powered document review workspace for turning legal and business documents into structured, queryable tables. This branch uses **OpenRouter** for all AI features.

## Features

- Extract clauses, dates, amounts and entities into custom columns.
- Convert PDF and DOCX files locally with Docling; import text and Markdown directly.
- Inspect exact supporting quotes and mark answers as verified.
- Generate or improve extraction prompts with AI.
- Chat with your extracted dataset, save projects and maintain a column library.

## Local setup

Requires Node.js 22.18 or later, pnpm, and Python 3.11 or 3.12. Python 3.12 is recommended. Install from the repository root:

```bash
pnpm install
python3.12 -m venv server/venv
server/venv/bin/python -m pip install -r server/requirements.txt
```

Create the local configuration file:

```bash
cp .env.example .env
```

Edit `.env` and set your [OpenRouter API key](https://openrouter.ai/settings/keys):

```dotenv
OPENROUTER_API_KEY=your_openrouter_api_key_here
VITE_API_URL=http://localhost:8000
```

The key is read by the Python backend. It is never bundled into the frontend or stored in saved projects. Keep `.env` private; it is excluded from Git and Docker build contexts. Restart the backend after changing the key. Do not use a `VITE_` prefix for secrets.

Start the backend:

```bash
./start-backend.sh
```

Start the frontend in another terminal:

```bash
pnpm dev
```

Open [the app](http://localhost:3000). The backend must run for both AI requests and PDF/DOCX conversion. Docling may download its processing models on the first PDF conversion; those run locally and do not need an AI API key. On Apple Silicon, the existing MPS acceleration is enabled.

### Model selection

The default model is **OpenRouter Free** (`openrouter/free`). The model menu also offers GPT-4.1 Mini, GPT-4.1 and Claude Sonnet 4.5 through OpenRouter. To use another model, enter its full OpenRouter ID under **Other OpenRouter model**, for example `provider/model-name`. Choose a model with [structured output support](https://openrouter.ai/docs/guides/features/structured-outputs) for extraction. Requests require providers to honor the JSON schema, and the app validates returned fields and supporting quotes.

Older saved projects with bare Gemini model IDs use the new default when loaded. Existing documents, columns and results remain available.

OpenRouter usage is billed to the key's account. Invalid keys, insufficient credits, unsupported models and provider errors are displayed in the app.

## Docker alternative

Create `.env` as above, then run:

```bash
docker compose up --build
```

Open [the app](http://localhost:3001) or [backend documentation](http://localhost:8000/docs). The API key is passed only to the backend. `VITE_API_URL` is the browser-accessible backend address and is applied at frontend build time; rebuild after changing it.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
server/venv/bin/python -m unittest discover -s server -p 'test_*.py' -v
server/venv/bin/python -m pip check
```

The automated AI tests use mocked OpenRouter responses and do not incur charges. Testing real model output requires your API key and OpenRouter credits.

## License

MIT; see [LICENSE](LICENSE).

Always verify AI-generated results against the original documents.
