# SecondLook explanation service

Start here: **[../STARTUP.md](../STARTUP.md)** contains the team's current install, startup, and demo checks.

The Flask service serves the frontend and `POST /api/explain` together at **http://localhost:3000**. Use `python3 server/server.py` from the project root or `./start.sh`. Do not use the old port-8000 file server for the integrated demo.

## Configuration

Copy `.env.example` to `.env` in this directory. `AI_PROVIDER=none` runs the template fallback without a key. Set `AI_PROVIDER=openai` and your local `OPENAI_API_KEY` to enable the existing model adapter. Restart after changing configuration. Never commit the key.

The server binds to localhost with debugging off. Only the frontend entry page and allowed assets are public. Server source, configuration files, and repository metadata return 404.

## API contract

`POST /api/explain` accepts the Analysis event from `PROJECT_BRIEF.md` and returns the Explanation object directly. `event_id` links an explanation to the active finding. The supplied action and limitations are preserved. Explanations describe the actual evidence window using explicit units and simulation context.

`GET /api/health` reports configuration. Its `ai_available` flag checks whether a key is present; it does not prove a real model call succeeded. Verify an accepted response labeled **AI explanation** in the demo. API failure returns a clearly labeled template.

Requests use a five-second configured timeout and no automatic model retries so fallback can appear within the UI's six-second timeout. The output contract is validated; generated prose is not automatically fact-checked.

Run focused tests from the project root:

```sh
python3 -m unittest discover -s tests -p 'test_server.py'
```

These tests mock the model and require no real credentials. Live AI still needs a manual check.
