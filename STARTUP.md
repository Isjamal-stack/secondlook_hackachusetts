# Start the team demo

Use the latest `test` branch. The simulator, rule evidence, and explanation service are connected automatically. The presentation now exposes only the working Dashboard. Secondary pages are hidden; their source and stored data are preserved.

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

Or run `python3 server/server.py` from the project folder. Open **http://localhost:3000/?demo=reviewed-4**.

Restart an already-running server to pick up these Python changes. Use this one server for the webpage and `/api/explain`. The old file server on port 8000 cannot provide explanations. If an old preview is still running, use port 3000.

Without credentials, the app uses clearly labeled template explanations. The app binds to this computer only, with debugging off. Server files, credentials, and repository metadata are blocked from frontend routes.

## Optional: enable live AI

Copy `server/.env.example` to `server/.env`. Set `AI_PROVIDER=openai` and enter your own `OPENAI_API_KEY` privately in that local file. Restart the server.

Do not commit or share the key. The server loads this file regardless of which folder you launch from. A successful response is labeled **AI explanation**; an unavailable service uses **Template explanation · Fallback**. `/api/health` reports configuration, not proof that a real model call succeeded.

## Check the demo together

1. **Normal warm-up:** At second 30, expect stable-temperature evidence of **90 → 90°C over 10 seconds**. No attention alert.
2. **Rising engine temperature:** At second 20, expect **92 → 100°C over 10 seconds** and **Needs attention**.
3. **Evidence versus live values:** Rule evidence stays fixed at the triggering window while the live gauge and chart continue. This is intentional.
4. **Controls:** Pause freezes readings; Resume continues. Reset clears readings, chart, evidence, and explanation.
5. **Explanation:** With AI enabled, verify one real **AI explanation**. With `AI_PROVIDER=none`, verify a labeled template. Approved actions and urgency remain controlled by the rules. AI wording that claims normal ranges, component operation, overall health, or adds numbers is rejected in favor of the prepared template. The guard is conservative, not a complete fact checker.

6. **Presentation scope:** Only Dashboard is available. Import, diagnostic scans, Bluetooth, maintenance, settings, and History are not presented as working features.
7. **Fallback without editing credentials:** In another terminal, run `AI_PROVIDER=none PORT=3002 python3 server/server.py` and open `http://localhost:3002/?demo=reviewed-4`. Repeat either scenario and Reset. This does not change `server/.env`.

Scenarios last 45 seconds and are time-compressed. Their thresholds are demo rules, not universal limits for real cars.

## Team handoff

- A's simulator and rules are unchanged. C now installs the existing `createSimulation` factory at startup.
- B's endpoint receives and returns the same shared formats.
- `DEMO_INTEGRATION.md` describes the interfaces; `PROJECT_BRIEF.md` contains the overall scope.
- Keep work on `test`; avoid new features until the full demo is verified.

## Focused checks

```sh
node --experimental-default-type=module --test tests/part-a.test.mjs tests/ui-demo.test.mjs
python3 -m unittest discover -s tests -p 'test_server.py'
```

Use Node 22 or newer for A's tests. Server tests mock model calls and need no API key. All 28 tests pass: 10 simulator/rule tests, 13 server tests, and 5 UI-harness checks. Request validation, response/event matching, grounded fallback, cache identity, both scenarios, pause/resume, and Reset are covered. The UI harness uses stub DOM/Chart objects, so it does not verify actual browser layout.

Live provider calls and final HTTP endpoint checks for both actual simulator findings succeeded with grounded qualitative prose after tightening the prompt. Both endpoint responses returned 200 with source `ai`, matching event IDs, and unchanged approved actions/limitations. Initial live wording rejected by the guard correctly selected prepared templates. No credential file was displayed or edited. Visual browser review is complete: the user confirmed both scenarios, live AI wording, chart rendering, pause/resume, and Reset passed. All 28 tests were independently rerun successfully. Real hardware and offline/CDN failures remain untested. History is hidden; its legacy min/max issue is deferred.

Shared formats are unchanged. Run IDs now include a per-page UUID, and cache keys include the full event payload so an ID cannot return an explanation for changed evidence. See `DEMO_INTEGRATION.md` for the exact request/response checks and connections.
