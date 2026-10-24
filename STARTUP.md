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

Or run `python3 server/server.py` from the project folder. Open **http://localhost:3000/?demo=understand-5**.

Restart an already-running server to pick up these Python changes. Use this one server for the webpage and `/api/explain`. The old file server on port 8000 cannot provide explanations. If an old preview is still running, use port 3000.

Without credentials, the app uses clearly labeled template explanations. The app binds to this computer only, with debugging off. Server files, credentials, and repository metadata are blocked from frontend routes.

## Optional: enable live AI

Copy `server/.env.example` to `server/.env`. Set `AI_PROVIDER=openai` and enter your own `OPENAI_API_KEY` privately in that local file. Restart the server.

Do not commit or share the key. The server loads this file regardless of which folder you launch from. A successful response is labeled **AI explanation**; an unavailable service uses **Template explanation · Fallback**. `/api/health` reports configuration, not proof that a real model call succeeded.

## Check the demo together

1. Leave **Normal warm-up** selected and click **Start**. Click **Pause**, confirm gauges/chart freeze, then **Resume**.
2. At second **30**, expect **Temperature steady**, evidence **90 → 90°C over 10 seconds**, a chart circle at **30 s / 90°C**, and highlighted readings from **20–30 s**. Open **Why this demo rule matched** to see the configured stable-rule conditions.
3. At second **45**, the run finishes. Check the summary says no attention finding was recorded and does not claim the whole vehicle is healthy.
4. Choose **Rising engine temperature**; the old run clears. Click **Start**. A steady finding appears at second 10; at second **20**, expect **Temperature rising**, **Needs attention**, evidence **92 → 100°C over 10 seconds**, and a triangle at **20 s / 100°C** highlighting **10–20 s**. Open the rule details for actual demo thresholds, not vehicle-specific limits.
5. Watch the live temperature continue to **112°C**. The triangle stays at the triggering **100°C**. At second **45**, check the summary records the attention at second 20, its readings/window, and A's approved next step.
6. Open **Understand the terms**. Read **What the car reported** beside **What this means**, and check the AI/template source label. The existing grounding guard and prepared fallback remain active.
7. Click **Replay** or **Reset**, or change scenarios during an explanation request. Old readings, finding markers/windows, and summary must clear. A late AI reply must not restore them.
8. **Presentation scope:** Only Dashboard is available. No new pages or hardware features were added.
9. **Fallback without editing credentials:** In another terminal, run `AI_PROVIDER=none PORT=3002 python3 server/server.py` and open `http://localhost:3002/?demo=understand-5`. Repeat a scenario and Reset. This does not change `server/.env`.

Scenarios last 45 seconds and are time-compressed. Their thresholds are demo rules, not universal limits for real cars.

## Team handoff

- A's simulator and rule behavior are preserved. C imports `RULES` for descriptions; the existing downward-step tolerance is now named `rise_step_tolerance_c` in that configuration with the same value. The existing `createSimulation` factory is still installed at startup.
- B's endpoint receives and returns the same shared formats.
- `DEMO_INTEGRATION.md` describes the interfaces; `PROJECT_BRIEF.md` contains the overall scope.
- Keep work on `test`; avoid new features until the full demo is verified.

## Focused checks

```sh
node --experimental-default-type=module --test tests/part-a.test.mjs tests/ui-demo.test.mjs tests/presentation.test.mjs
python3 -m unittest discover -s tests -p 'test_server.py'
```

Use Node 22 or newer. All **34 tests pass**: 10 simulator/rule tests, 13 server tests, eight UI-harness tests, and three presentation-helper tests. These include the original 28 checks plus rule-description accuracy, timestamp-anchored markers, supporting windows across pauses, event-history summaries, and clearing on Reset/Replay/scenario changes. UI tests use stub DOM/Chart objects and do not verify browser layout.

The prior live AI checks passed. Independent visual review passed for both scenarios, chart markers and supporting windows, expandable rule explanations, glossary, trip summaries, Pause/Resume, Replay, and Reset. All 34 tests were independently confirmed passing. Real hardware and offline/CDN failures remain untested. History remains hidden.

Shared formats and UI connection functions are unchanged. No server AI/fallback or credential changes were made. See `DEMO_INTEGRATION.md` for rule configuration, marker matching, glossary sources, and summary ownership.
