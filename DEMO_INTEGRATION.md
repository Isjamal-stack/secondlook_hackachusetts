# Person C: demo preview and connection guide

`PROJECT_BRIEF.md` is the overall plan. This file describes the current connections and presentation checks. Shared Reading, Analysis event, and Explanation formats are unchanged. A's simulator behavior and rule thresholds are preserved. The existing inline downward-step tolerance is now named `RULES.rise_step_tolerance_c`, with the same value and behavior, so the interface can read it directly.

## Current interface: understanding a run

The main status comes only from the active analysis event: `insufficient_data` → **Collecting readings**, `normal_warmup` → **Temperature steady**, `sustained_temperature_rise` → **Temperature rising**, and `data_unavailable` → **Readings unavailable**. A's urgency and limitations remain visible. AI output cannot replace this status.

**What the car reported** shows frozen numeric evidence and its observation duration. Expand **Why this demo rule matched** for the actual configured window, start/end/change thresholds, stability range, recovery duration, and downward-step tolerance. `js/demo-presentation.js` imports A's `RULES`; it does not evaluate new rules or maintain copies of their constants. The source's previous inline `0.5` tolerance moved into the configuration without changing detector behavior. Thresholds are explicitly demo rules, not universal vehicle limits.

**What this means** retains the existing AI/prepared explanation and honest source label. The approved next step is prominent above both sections. **Understand the terms** provides deterministic definitions of coolant temperature, engine load, RPM, and observation window. Definitions were editorially checked against [Ford's coolant guide](https://www.ford.co.uk/support/how-tos/owner-resources/vehicle-maintenance/how-to-check-and-add-engine-coolant) and [OTC's scan-tool guide](https://otctools.com/sites/default/files/pdf_english_16336.pdf); they are concept explanations, not vehicle assessments. AI remains limited to the observed trend/uncertainty; there are no server, prompt, or wording-guard changes in this update.

The chart adds a **circle** for a normal finding and a **triangle** for an attention/urgent finding. Each marker requires an actual reading with matching `observed_at_ms`, scenario, and evidence end value, plus a matching start reading. The highlighted line section uses only plotted readings from that evidence window. Window boundaries use elapsed time after timestamp anchoring, so a pause does not shift them. If anchors are unavailable, no approximate marker is invented. Marker captions and tooltips show trigger time/value separately from the latest gauge.

At scenario completion, an **end-of-trip summary** uses copied events recorded in this run. It lists each attention/urgent finding, its matched elapsed time (or explicitly unavailable time), supporting values/duration, and original approved action. No new AI request is made for the summary. A run without attention is described narrowly and never called healthy. A later recovery does not erase earlier attention.

Reset, Replay, scenario changes, and adapter reconfiguration clear stored readings/events, markers, highlighted windows, and summary. Existing run tokens, event matching, and request cancellation prevent late AI responses from restoring old content. Shared data objects and public UI function signatures are unchanged; `rise_step_tolerance_c` is an additive configuration property, not a new event field.

## What changed for the presentation

- Only the working dashboard is available. Connect, Diagnostics, History, Maintenance, and Settings are hidden, disabled, and blocked by navigation. Their source and stored data remain intact. History's legacy statistics have not been repaired because History is hidden.
- Import no longer claims success without saving data; its handler explicitly says import is unavailable and no data was saved. The static diagnostic-health claim has been replaced with “No diagnostic scan has been performed.” No Bluetooth, maintenance, or settings system was added.
- **Rule evidence** stays visible beside the explanation. The live gauges/chart continue after a finding, while its evidence stays fixed at the triggering window.
- Numeric observation, overall status, urgency, next step, and limitations come from deterministic code/A's event. AI supplies only a short qualitative description of the observed direction and uncertainty.
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

Follow `STARTUP.md`: run `./start.sh`, then open **http://localhost:3000/?demo=understand-5**. Restart an already-running server to load the Python changes. Use a fresh URL query/hard refresh if an older service worker cached the page. CSS/JS entry URLs are versioned. Chart.js still needs the existing CDN connection.

1. **Normal warm-up:** Click Start, then Pause and Resume. At second 30, expect **Temperature steady**, evidence **90 → 90°C over 10 s**, a circle at **30 s / 90°C**, and highlighted **20–30 s** readings. Expand **Why this demo rule matched** to check A's stability range and duration.
2. Let the run finish at second 45. The summary should say no attention finding was recorded, with the explicit limitation about whole-vehicle condition.
3. Select **Rising engine temperature** (clears the previous run), then Start. A steady finding first appears at second 10. At second 20, expect **Temperature rising**, **92 → 100°C over 10 s**, a triangle at **20 s / 100°C**, and a highlighted **10–20 s** window. Open the rule details to see the configured thresholds. By the end the live temperature is 112°C, while this finding remains at 100°C.
4. At second 45, check that the summary records the attention finding at second 20, its evidence/window, and its approved next step. The summary does not ask AI for another explanation.
5. Open **Understand the terms**. Check the source label beneath **What this means**. The existing API still accepts only explanations matching the active event, with prepared fallback for failures or blocked prose.
6. Click Replay: the summary, previous markers, evidence, and chart clear before a new run. Reset or switch scenarios while an explanation is pending; an old response must not restore them. Confirm only Dashboard is accessible.
7. To check fallback without touching credentials, run another local process with `AI_PROVIDER=none PORT=3002 python3 server/server.py`; open port 3002 and repeat a scenario.

## Current verification

All 34 automated tests pass: A's unchanged 10 tests, 13 unchanged server tests, eight UI-harness tests, and three new presentation-helper tests. The original 28 checks remain passing. New checks cover configuration-driven rule descriptions, exact marker placement (including pause gaps and missing anchors), summaries that retain earlier attention, event-derived status, Replay, scenario changes, and Reset during an explanation request. UI tests use DOM/Chart stubs, not a real renderer.

The preceding version's visual browser review and live AI/API checks were completed and recorded by the team. This update does not alter the server AI path. Independent visual review passed for both scenarios, chart markers and supporting windows, expandable rule explanations, glossary, trip summaries, Pause/Resume, Replay, and Reset. All 34 tests were independently confirmed passing. Offline/CDN rendering, real hardware, hidden History statistics, and destructive data operations remain outside these checks. Credentials were neither displayed nor changed.
