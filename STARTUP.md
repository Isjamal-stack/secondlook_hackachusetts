# Start the team demo

Use the latest `test` branch. The simulator, rule evidence, and explanation service are now connected automatically.

## Install once

From the project folder, using Python 3.9 or newer:

```sh
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r server/requirements.txt
```

## Start the app

```sh
source venv/bin/activate
./start.sh
```

Or run `python3 server/server.py` from the project folder. Open **http://localhost:3000/?demo=integrated**.

Use this one server for the webpage and `/api/explain`. The old file server on port 8000 cannot provide explanations. If an old preview is still running, use port 3000.

Without credentials, the app uses clearly labeled template explanations. The app binds to this computer only, with debugging off. Server files, credentials, and repository metadata are blocked from frontend routes.

## Optional: enable live AI

Copy `server/.env.example` to `server/.env`. Set `AI_PROVIDER=openai` and enter your own `OPENAI_API_KEY` privately in that local file. Restart the server.

Do not commit or share the key. The server loads this file regardless of which folder you launch from. A successful response is labeled **AI explanation**; an unavailable service uses **Template explanation · Fallback**. `/api/health` reports configuration, not proof that a real model call succeeded.

## Check the demo together

1. **Normal warm-up:** At second 30, expect stable-temperature evidence of **90 → 90°C over 10 seconds**. No attention alert.
2. **Rising engine temperature:** At second 20, expect **92 → 100°C over 10 seconds** and **Needs attention**.
3. **Evidence versus live values:** Rule evidence stays fixed at the triggering window while the live gauge and chart continue. This is intentional.
4. **Controls:** Pause freezes readings; Resume continues. Reset clears readings, chart, evidence, and explanation.
5. **Explanation:** With AI enabled, verify one real **AI explanation**. With `AI_PROVIDER=none`, verify a labeled template. Approved actions and urgency remain controlled by the rules.

Scenarios last 45 seconds and are time-compressed. Their thresholds are demo rules, not universal limits for real cars.

## Team handoff

- A's simulator and rules are unchanged. C now installs the existing `createSimulation` factory at startup.
- B's endpoint receives and returns the same shared formats.
- `DEMO_INTEGRATION.md` describes the interfaces; `PROJECT_BRIEF.md` contains the overall scope.
- Keep work on `test`; avoid new features until the full demo is verified.

## Focused checks

```sh
node --experimental-default-type=module --test tests/part-a.test.mjs
python3 -m unittest discover -s tests -p 'test_server.py'
```

Use Node 22 or newer for A's tests. Server tests mock model calls and need no API key. Live AI still needs a manual check with locally configured credentials.
