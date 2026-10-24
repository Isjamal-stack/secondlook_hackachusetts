# Person A — simulator and analysis handoff

Based on Saim's `db5aee3` commit. Only Part A files changed. No edits to
`js/app.js`, `index.html`, CSS, service worker, dependency manifests, or B's server.

## Connect to C's existing dashboard

After the page has loaded, run this in its browser console to preview A's data:

```js
const { installSimulation } = await import('./js/simulation-adapter.js');
installSimulation();
```

For permanent integration, C can import `createSimulation` from
`./simulation.js` into `js/app.js` and call `configureDemo({ createSimulation })`
immediately after `initializeDemo()`. C owns that UI change. Do not import a second
copy of `app.js` under another URL: it would register duplicate listeners.
The adapter does not replace B's explanation adapter. Events are delivered without
fixture explanations, so C's existing `/api/explain` and template fallback run.

Start, Pause, Resume, Reset, Replay, and scenario selection use C's existing controls.
Both simulations emit 46 readings, elapsed seconds 0 through 45, at one-second
intervals. The first reading arrives on Start. This is a time-compressed demo,
not a claim about how quickly a real vehicle warms up.

## Public exports

- `js/simulation.js`: `createSimulation(options)`, `readingAt(scenario_id, elapsed_s, timestamp_ms)`, `SCENARIOS`.
- `js/insight-engine.js`: `createInsightEngine({scenario_id, run_id})`, `validateReading(input)`, `RULES`, `LIMITATIONS`.
- `js/simulation-adapter.js`: `installSimulation(ui = window.secondLookUI)`.

`createSimulation` implements the exact factory and callbacks in `DEMO_INTEGRATION.md`.
Use a unique `run_id` per controller/run. Returned controls are synchronous
`start()`, `pause()`, and `reset()`. Reset clears history; event counters are retained
to avoid reusing IDs. Timer generation checks ignore callbacks from a paused/reset run.
Readings are Celsius, km/h, RPM, percent; missing/invalid values normalize to `null`.
Pause freezes elapsed scenario time. Resume uses current wall-clock timestamps,
so a deliberate pause is not treated as stale data.

For direct engine use, `analyze(reading, now_ms)` returns an event only when the
condition changes, otherwise `null`. `reset()` clears its history and active finding.
Call `analyze` with an old or missing reading to report an unavailable source;
this pure engine does not run a separate inactivity watchdog. The simulator supplies
fresh readings while running. `validateReading` returns `{reading, issues}`.

## Conditions and expected evidence

| Condition | Urgency | Prototype rule / fixture outcome |
| --- | --- | --- |
| `insufficient_data` | `unknown` | Collecting a complete window, or neither rule matches |
| `data_unavailable` | `unknown` | Missing/invalid, stale (>3 s), future-dated, wrong-source, mismatched scenario, or duplicate/out-of-order reading |
| `normal_warmup` | `normal` | At least 10 s, all coolant 85–94 °C, range no more than 2 °C |
| `sustained_temperature_rise` | `attention` | 10 s window starting at least 92 °C, ending at least 100 °C, rising at least 4 °C, no step drop greater than 0.5 °C |

Normal scenario: 40 → 90 °C, stabilizing at second 20. Normal finding at second 30
has evidence **90 → 90 °C over 10 s**. No attention event.

Rise scenario: hold 92 °C for 10 s, then rise 0.8 °C/s, capped at 112 °C.
It first shows the stable baseline; as that changes it returns to unknown until
second 20, when attention has evidence **92 → 100 °C over 10 s**. That event remains
active rather than regenerating every tick. No urgent condition or repair diagnosis.

Recovery from attention needs a full 15 s stable window in the normal demo band.
Missing/invalid data clears the window and overrides attention with unknown.
An elapsed sampling gap over 2 s restarts window collection. Evidence is drawn from
the actual triggering samples, and is frozen with that event; it is not a live gauge.
These thresholds are prototype fixtures, not vehicle-specific diagnostic limits.
Approved next steps and limitations live alongside the rules; the temperature
message refers to the vehicle handbook rather than prescribing a repair procedure.

## Units boundary

Fixed the existing `BluetoothManager` mock PID 05 value from 195 to 90 Celsius.
The existing decoder correctly uses A − 40. The new simulator emits normalized
readings directly; it does not use the legacy random PID responses or history.
Legacy sample history still has Fahrenheit-like values and stays isolated, as the
brief allows. No migration or legacy chart/unit settings were changed.

## Verification

Run with Node 22 or newer (no dependencies or package manifest changes):

```sh
node --experimental-default-type=module --test tests/part-a.test.mjs
```

Covers repeatable scenario outcomes and exact evidence, missing/invalid values,
stale/future/duplicate readings, gaps, isolated spikes, recovery, timer lifecycle,
reset event IDs, adapter contract, and mock → real decoder Celsius round-trip.
Browser integration and B's live endpoint still require the team integration check.
