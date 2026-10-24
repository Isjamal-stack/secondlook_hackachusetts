# Person C: demo preview and handoff

Work is on `test`. No commit or push is needed to preview.

## Preview

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000/?demo=1**. The query avoids an old cached home page. The new JS/CSS entry URLs are versioned, and the app no longer registers the old cache-first service worker during this demo. If you previously loaded this exact URL before these changes, use a new query such as `?demo=2` or clear this site's service worker/cache in browser devtools, then reload.

Chart.js loads from the existing CDN, so use an internet connection. If it cannot load, the interface says so and the readings/controls still work.

1. Leave **Normal warm-up** selected, click **Start**, then **Pause** and **Resume**.
2. Within six readings, temperature levels off and an **Example explanation** appears.
3. Choose **Rising engine temperature**; this clears the first run. Click **Start**.
4. Temperature reaches 108 °C and a different example recommendation appears with numeric evidence.
5. Click **Reset**: readings, chart, recommendation, and playback clear. No adapter is required.

The six fixed rows in `js/demo-examples.js` are temporary UI fixtures. They are deliberately short, scripted examples, not Person A's simulator or diagnostic rules. Example events/explanations are prewritten; no AI request is sent for them. Legacy history data is isolated because its units differ.

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
