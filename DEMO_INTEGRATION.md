# Person C: demo preview and connection guide

`PROJECT_BRIEF.md` is the overall plan. This file describes the current connections and presentation checks. Shared Reading, Analysis event, and Explanation formats are unchanged. A's simulator and rule files are unchanged.

## What changed for the presentation

- Only the working dashboard is available. Connect, Diagnostics, History, Maintenance, and Settings are hidden, disabled, and blocked by navigation. Their source and stored data remain intact. History's legacy statistics have not been repaired because History is hidden.
- Import no longer claims success without saving data; its handler explicitly says import is unavailable and no data was saved. The static diagnostic-health claim has been replaced with “No diagnostic scan has been performed.” No Bluetooth, maintenance, or settings system was added.
- **Rule evidence** stays visible beside the explanation. The live gauges/chart continue after a finding, while its evidence stays fixed at the triggering window.
- Numeric observation, title, urgency, next step, and limitations come from deterministic code/A's event. AI supplies only a short qualitative description of the observed direction and uncertainty.
- The server rejects the review's unsupported normal-range, normal-warm-up, component-operation, and vehicle-health phrases, plus generated numeric measurements. Rejected/invalid AI output uses the prepared explanation with `explanation_source: 'template'`. The guard is deliberately conservative and can reject harmless phrasing; it is a limited check, not proof that all accepted prose is correct.
- Requests validate consumed shared fields, finite numeric evidence, nonnegative observation duration, urgency, and string limitations before model access. Malformed requests receive 400. Empty evidence is allowed for `unknown`, not a normal/attention/urgent finding.
- Responses require every Explanation field, a matching `event_id`, and the supplied action/limitations. The server retains its prepared title/action/limitations even when AI prose passes.
- Run IDs include a fresh per-page session UUID. The server caches by event ID plus a canonical full-payload fingerprint, so changed evidence or actions do not silently reuse another result.

## Rule evidence: what A supplies

| UI content | Existing analysis-event fields |
| --- | --- |
| Rule name | `condition`, formatted as a readable label |
| Triggering readings and units | `evidence[].metric`, `start_value`, `end_value` |
| Observation duration per metric | `evidence[].duration_s` (seconds) |
| Urgency, action, uncertainty | `urgency`, `approved_next_step`, `limitations` |
| Explanation ownership | Unique `event_id`, matching `scenario_id` |

A's `createSimulation` factory is already installed automatically. It emits normalized readings and analysis events via the callbacks below. It owns validation, timing, thresholds, and trend detection. C does not add rule logic. Supply real triggering windows and use the supplied `run_id` prefix for unique event IDs.

Required request fields: nonempty `event_id`, `scenario_id`, `condition`, and `approved_next_step`; one of `normal`, `attention`, `urgent`, `unknown` for urgency; `evidence` and `limitations` arrays. Evidence objects use the four shared metrics with finite `start_value`/`end_value` and nonnegative finite `duration_s`. If present, `observed_at_ms` must be finite and nonnegative. A continues to send it as defined in the brief. Missing live measurements remain `null`; they do not become numeric evidence for a normal finding.

## Exact connection points

Available on `window.secondLookUI` after load, with named exports from `js/app.js`:

- `renderReading(reading)` — shared Reading: `source: 'simulation'`, Celsius, km/h, RPM, percent. Missing values display `—`. Chart x-axis uses `elapsed_s`.
- `renderAnalysis(event, explanation?, { example: false }?)` — displays evidence immediately, then calls the same-origin endpoint unless a valid explanation is supplied.
- `renderExplanation(explanation)` — requires all output text fields and the active `event_id`. A different/stale ID returns `false` without replacing the finding.
- `configureDemo({ createSimulation, explain })` (global: `secondLookUI.configure`) — resets the run and installs supplied adapters; omitted adapters are preserved.
- `startDemo()`, `pauseDemo()`, `resetDemo()` (global: `start`, `pause`, `reset`).

Scenario IDs: `normal-warmup` and `temperature-rise`. The synchronous factory contract remains:

```js
createSimulation({ scenario_id, run_id, onReading, onAnalysis, onComplete })
// Returns { start(), pause(), reset() }.
```

Emit from `start()` or later, not from the constructor. Call `onAnalysis(event)` only when the finding changes. Use the provided callbacks so old callbacks are ignored after Reset/scenario changes. Six-reading example fixtures remain available in source for development but are not the default presentation path.

## Person B: matching the explanation

Serve the frontend and `POST /api/explain` together. Accept A's Analysis event and return the Explanation object directly, including the exact input `event_id`, `title`, `explanation`, `next_step`, `limitation`, and `explanation_source` (`ai` or `template`). The same event ID connects B's prose to A's finding; prose never replaces A's rule/evidence/action.

The default request has a six-second UI timeout and a five-second model timeout with no retries. Invalid output, blocked wording, timeout, and unavailable AI use a labeled template. A late response cannot restore an earlier run. The AI prompt now requests only two qualitative sentences; numeric evidence and approved advice are displayed separately. Do not treat a template response as a successful live-AI result.

An optional client adapter can still be supplied:

```js
secondLookUI.configure({
    explain: (event, { signal }) => yourExplanationClient(event, { signal })
});
```

Custom clients must preserve the server's validation/grounding checks; do not call a model directly from the browser. Passing `explain: null` restores the same-origin endpoint. Credentials remain server-only.

## Preview and check

Follow `STARTUP.md`: run `./start.sh`, then open **http://localhost:3000/?demo=reviewed-4**. Restart an already-running server to load the Python changes. Use a fresh URL query/hard refresh if an older service worker cached the page. CSS/JS entry URLs are versioned. Chart.js still needs the existing CDN connection.

1. **Normal warm-up:** Start; at second 30, rule evidence is **90 → 90°C over 10 s**, with normal urgency. Text describes a steady window, not normal coolant limits or functioning cooling parts.
2. **Rising engine temperature:** Switch scenarios (clears the run), then Start; at second 20, evidence is **92 → 100°C over 10 s**, with attention urgency. Text describes a rise, not “hotter than normal.”
3. Check the network response's `event_id` against the active event. Accept **AI explanation** only after an accepted real model response; **Template explanation · Fallback** is expected when AI is unavailable or rejected.
4. To check fallback without touching credentials, start another local process with `AI_PROVIDER=none PORT=3002 python3 server/server.py`; open port 3002 and repeat a scenario.
5. Pause/Resume once. Reset during an explanation request; gauges, chart, evidence, and explanation must clear, and a late response must not restore them. Confirm only Dashboard is accessible.

## Current verification

All 28 focused automated tests pass: A's unchanged 10 tests, 13 server tests (including seven new review regressions), and five new UI-harness tests. They cover the actual unsupported phrases from the review, malformed requests, faulty output, cache identity, both real simulator scenarios, source labels, fallback, pause/resume, chart data, session IDs, and Reset during a pending explanation. The UI tests use DOM/Chart stubs, not a real browser renderer.

Live provider calls for both actual scenario findings succeeded and passed the guard after the prompt adjustment. Earlier rejected live responses were replaced by prepared templates. Final HTTP requests to the updated `/api/explain` endpoint for both actual findings returned 200 with accepted `ai` explanations, matching event IDs, and unchanged approved actions/limitations. Credentials were neither displayed nor changed.

Visual browser review is complete: the user confirmed both scenarios, live AI wording, chart rendering, pause/resume, and Reset passed. All 28 tests were also independently rerun successfully. Offline/CDN outage rendering, real Bluetooth/car hardware, hidden legacy History statistics, and destructive stored-data operations were not tested in this fix pass.
