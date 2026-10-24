# Person C: demo preview and handoff

Work is on `test`. No commit or push is needed to preview.

## Interface update: Why this was flagged

The recommendation card now includes a compact **Why this was flagged** block alongside the explanation. It shows A's rule-based finding immediately and keeps it visible while B's explanation loads or falls back. Reset and scenario changes clear both. The existing controls, reading units, and chart are unchanged.

No shared data-format or function-signature changes are required. `PROJECT_BRIEF.md` remains the overall plan; this file is the practical connection guide.

| Display | Existing analysis-event fields |
| --- | --- |
| Rule | `condition`, shown with a readable label (for example, `sustained_temperature_rise` → “Sustained temperature rise”) |
| Triggering readings | Each `evidence[].metric`, `start_value`, and `end_value`, with the metric's units |
| Observation duration | Each `evidence[].duration_s`, in seconds; kept per metric rather than combined |
| Urgency, action, uncertainty | `urgency`, `approved_next_step`, and `limitations` in the surrounding recommendation card |

The shared format has no separate rule-name field: `condition` is the rule identifier used here. Unknown condition names are displayed with underscores replaced by spaces. The interface does not calculate thresholds, identify a rule, or infer an observation duration.

**Person A supplies:** normalized readings and an analysis event when the condition changes, including `condition`, unique `event_id`, selected `scenario_id`, `urgency`, `observed_at_ms`, numeric evidence with units defined by `metric`, `limitations`, and `approved_next_step`. Supply the readings that actually triggered your rule and its measured observation window. Use `run_id` in event IDs and the adapter callbacks below. No additional rule logic belongs in the interface.

**Person B matches the finding:** return the exact input `event_id` in the Explanation object. `renderExplanation()` accepts only the currently active event ID; a different ID is ignored. AI text updates the title and explanation, while the rule, measurements, durations, urgency, and approved action stay owned by A's event. A timeout, invalid response, or unavailable service leaves the labeled template visible. Use a new event ID for a new finding and for each run.

## Preview

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000/?demo=2**. The query avoids an old cached home page. The new JS/CSS entry URLs are versioned, and the app no longer registers the old cache-first service worker during this demo. If you previously loaded this exact URL before these changes, use a new query such as `?demo=3` or clear this site's service worker/cache in browser devtools, then reload.

Chart.js loads from the existing CDN, so use an internet connection. If it cannot load, the interface says so and the readings/controls still work.

1. Leave **Normal warm-up** selected, click **Start**, then **Pause** and **Resume**.
2. Within six readings, temperature levels off and an **Example explanation** appears.
3. Choose **Rising engine temperature**; this clears the first run. Click **Start**.
4. Temperature reaches 108 °C. **Why this was flagged** shows **Sustained temperature rise**, **92 → 108 °C**, and **5 s** for `coolant_c`, alongside the clearly labeled example explanation. These are fixture values, not diagnostic thresholds.
5. Click **Reset**: readings, chart, recommendation, and playback clear. No adapter is required.

The six fixed rows in `js/demo-examples.js` are temporary UI fixtures. They are deliberately short, scripted examples, not Person A's simulator or diagnostic rules. Example events/explanations are prewritten; no AI request is sent for them. Legacy history data is isolated because its units differ.

### Check the team integration

After installing A's controller adapter, start both scenarios and check that the displayed rule, start/end readings, and duration match A's event exactly. The normal scenario must keep its normal urgency; a missing finding should continue to say it is waiting for analysis.

With B's same-origin service running, confirm `POST /api/explain` receives that event and its response repeats the same `event_id`. The source should change to **AI explanation** only for an accepted AI response. In the browser console, `secondLookUI.renderExplanation()` returns `false` for an explanation with a different ID and leaves the current finding untouched. An unavailable endpoint should keep **Template explanation · Fallback** while readings continue.

Pause/resume once, then Reset or change scenarios while an explanation is pending. The readings, chart, rule, and duration must clear; an old response must not restore them. Example playback intentionally uses local explanations, so connect A before checking B's network request.

## Exact connection points

Available after page load on `window.secondLookUI`, and as named exports from `js/app.js`:

- `renderReading(reading)` — the brief's Reading object. `null` displays as `—`; temperature is Celsius and speed is km/h. Adds a chart point using `elapsed_s`.
- `renderAnalysis(event, explanation?, { example: false }?)` — the brief's Analysis event. Renders numeric evidence, urgency, approved action, and limitations immediately. If no valid explanation is supplied, requests `POST /api/explain` with the event as the JSON body. Expects the Explanation object directly as JSON.
- `renderExplanation(explanation)` — the brief's Explanation object. Requires a matching active `event_id` and nonempty output fields. Uses the analysis's approved next step and retains its limitations. Invalid/stale outputs leave the template visible.
- `configureDemo({ createSimulation, explain })` (global name: `secondLookUI.configure`) — installs adapters and resets the run. Use this once the modules arrive; no teammate files need to be edited by C.
- `startDemo()`, `pauseDemo()`, `resetDemo()` (global names: `start`, `pause`, `reset`).

`scenario_id` must match the selected value: `normal-warmup` or `temperature-rise`. Readings must have `source: 'simulation'`. Events need unique `event_id` values per run; use the supplied `run_id` prefix.

### Person A: controller adapter

```js
window.secondLookUI.configure({
    createSimulation({ scenario_id, run_id, onReading, onAnalysis, onComplete }) {
        // Adapt your simulator/insight-engine exports here.
        // Deliver normalized readings via onReading(reading).
        // Deliver condition changes via onAnalysis(event).
        // Call onComplete() when the scenario finishes.
        return {
            start() { /* start or resume; advance only while running */ },
            pause() { /* stop advancing and emitting */ },
            reset() { /* release timers and clear analysis history */ }
        };
    }
});
```

`createSimulation` is a synchronous factory. Its returned methods are synchronous controls; reading/event callbacks may fire later. Emit the first reading from `start()`, after the factory returns. The UI owns the controls; A owns timing, readings, validation, and trend detection. Use these provided callbacks so Reset automatically ignores callbacks from earlier runs. Scenario changes also reset. The UI does not infer normal health when no analysis is available.

### Person B: explanation endpoint

Serve the frontend and **POST `/api/explain`** on the same origin. Accept the brief's Analysis event and return the brief's Explanation object directly, with `explanation_source: 'ai'` or `'template'`. No browser API keys.

There is already a six-second timeout, immediate labeled template fallback, one request per active event ID, and protection against late responses after reset/scenario changes. B should validate AI output on the server as planned in the brief.

If B exposes a client adapter instead of the same-origin route:

```js
window.secondLookUI.configure({
    explain: (event, { signal }) => yourExplanationClient(event, { signal })
});
```

Configure accepts either or both adapters and preserves any adapter you omit. Passing `explain: null` restores the default endpoint request. Configuring only the explanation client keeps the example playback until A is connected; fixtures intentionally keep their own labeled example explanations.

## Verification performed

JavaScript syntax and whitespace checks passed. A temporary Node DOM/Chart harness exercised start, duplicate-start prevention, pause/resume, both fixture runs, evidence and unit labels, chart data updates, reset, missing values, and ignored callbacks from a previous run. The user subsequently visually checked the interface and confirmed it works.

For the new finding block, focused checks cover condition labels, evidence values and units, per-metric duration, matching/mismatched explanation IDs, and reset. The previous dashboard was visually confirmed by the user; the new block still needs visual review.
