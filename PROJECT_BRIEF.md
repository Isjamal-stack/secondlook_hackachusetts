# SecondLook — Four-Hour Team Brief

**Status:** Proposed execution plan for team agreement  
**Team:** Three people; assign names to A, B, and C before starting  
**Working branch:** `test`  
**Constraint:** Approximately four hours until presentation; simulation is accepted  
**Reviewed baseline:** `test` commit `7819c45411a45fd451fdf1a1f02de7d9f1e5e08c` on October 24, 2026  
**Timing:** All times below are elapsed minutes from team kickoff. Confirm the actual presentation deadline and shorten build time if less than four hours remains.

## 1. Purpose

SecondLook helps drivers with limited mechanical knowledge understand vehicle readings and decide what deserves attention. We simulate OBD-II-style data, identify meaningful patterns, and turn those patterns into plain-language explanations with visible evidence and a clear next step.

Our target user is a first-time car owner who can see a reading or warning but does not know what it means or how urgently to respond.

**Product promise:** “Understand what your car is reporting, why it matters, and what to do next.”

The intended impact is better understanding and more informed maintenance conversations. Reduced repair costs or breakdowns are future outcomes to validate, not results we have already demonstrated.

## 2. What success looks like today

A judge can start a simulated trip, see readings change, observe a developing condition, and understand the recommendation through its evidence. The team can explain which parts are simulated, which decisions come from rules, and which explanations come from AI.

The complete experience is:

**Start scenario → timestamped readings → validation → trend detection → explanation → evidence and next step.**

The demo must work from a clean reload and survive an unavailable AI service. Clear fallback text is acceptable when labeled honestly.

## 3. Current implementation baseline

This is a source review, not confirmation that the app has been run successfully.

- Existing frontend: HTML, CSS, and JavaScript modules.
- Existing code includes storage, sample history generation, and history charts.
- The `test` branch adds protocol initialization, PID decoding, and simulated command responses.
- `connectTCP()` currently enables browser-generated responses. It does not connect to the Python TCP emulator. Present this as simulation.
- The app's connection handler checks Web Bluetooth availability before offering simulation. Demo mode needs its own entry point that works without Bluetooth.
- The worker's polling and parsing remain placeholders; do not make finishing that worker a dependency for this demo.
- The reviewed tree has no AI explanation service.
- Existing documentation includes aspirational or stale feature claims. This brief governs presentation scope; verify any claim before making it.

**Immediate data bug:** The mock coolant response encodes `195` as a normal temperature, and the decoder returns that as Celsius. The historical sample generator also appears to use Fahrenheit-like temperature values. Use Celsius internally throughout the demo and display units explicitly. Do not mix legacy history into the new demo until converted or isolated.

## 4. Scope

### Required

- One obvious “Start simulation” action independent of Bluetooth support.
- Two reliable scenarios: normal warm-up and a sustained temperature rise.
- Live display of RPM, speed, coolant temperature, and engine load.
- Start, pause, and reset/replay controls.
- Deterministic scenario progression; small optional noise must not change the expected outcome.
- A recent reading window used to detect a trend, rather than one isolated value.
- One prominent recommendation card containing observation, urgency, evidence, next step, and limitation.
- AI explanation through a server-side endpoint, with a usable template fallback.
- Persistent “Simulated vehicle data” labeling and an explanation-source label.
- One readable trend chart supporting the recommendation.

### Add only after required scope works

- A prolonged-idling scenario.
- A compact trip summary suitable for discussing with a mechanic.
- Small visual improvements or additional useful readings.

### Deferred

Real adapters, Bluetooth debugging, a TCP bridge, model training, predictive maintenance, precise repair diagnoses, repair-cost estimates, authentication, cloud sync, new history pages, elaborate animations, and a framework migration.

Existing secondary pages may remain, but the presentation follows only the verified demo flow.

## 5. Recommended stack and architecture

Keep the current vanilla JavaScript frontend, CSS, and Chart.js. Reuse IndexedDB only where useful; storing every demo reading is not a prerequisite. Add a small Node/Express service for the AI request, using the model provider the team already has access to. Keep credentials in server environment variables and out of browser code and Git.

Use the existing simulated command/decoder path if it can consume one coherent scenario state. Otherwise, emit normalized readings directly through a clearly named simulation module. Either path must feed the same analysis and UI interfaces. Do not build both paths in the time available.

Readings update approximately once per second. Ordinary code validates measurements and produces evidence and a condition. AI explains that condition using the supplied evidence. The model does not control the observed values or invent the urgency.

Generate explanations when the condition changes, not every second. Cache by event ID. Use a bounded request timeout, reject invalid responses, and use the fallback on failure. Ignore late responses from a previous scenario or reset.

## 6. Shared interfaces — agree before splitting up

### Reading

```json
{
  "scenario_id": "temperature-rise",
  "timestamp_ms": 1700000000000,
  "elapsed_s": 42,
  "source": "simulation",
  "rpm": 1800,
  "speed_kmh": 30,
  "coolant_c": 102,
  "engine_load_pct": 42
}
```

Example values illustrate the interface, not diagnostic thresholds. Missing measurements are `null`, never silently replaced with zero. Use milliseconds for timestamps, seconds for durations, Celsius for temperature, km/h for speed, and 0–100 for percentages.

All PIDs in a sampling cycle should reflect one shared simulation state. Independent random speed and RPM values should not produce contradictory recommendations. Advance scenario time only while running.

### Analysis event

```json
{
  "event_id": "run-1-temperature-rise-1",
  "scenario_id": "temperature-rise",
  "condition": "sustained_temperature_rise",
  "urgency": "attention",
  "observed_at_ms": 1700000000000,
  "evidence": [
    {
      "metric": "coolant_c",
      "start_value": 92,
      "end_value": 108,
      "duration_s": 45
    }
  ],
  "limitations": ["Exact mechanical cause cannot be determined from these readings."],
  "approved_next_step": "Use the reviewed scenario-specific guidance."
}
```

Agree on the condition and urgency enums before implementation. Suggested urgency values: `normal`, `attention`, `urgent`, and `unknown`. Missing/stale data produces `unknown`, not a normal-health conclusion. Treat example numbers as demo fixtures, not universal vehicle limits.

### Explanation

```json
{
  "event_id": "run-1-temperature-rise-1",
  "title": "Coolant temperature is continuing to rise",
  "explanation": "A short explanation tied to the supplied evidence.",
  "next_step": "The reviewed action supplied by the analysis layer.",
  "limitation": "These readings do not identify the failed component.",
  "explanation_source": "ai"
}
```

Use `ai` or `template` for `explanation_source`. Display numeric evidence directly from the analysis event. Validate the event ID and output fields before display. The model must not override urgency, invent measurements, claim a specific component failure, or invent a confidence percentage. Prefer returning the approved next step unchanged and letting AI explain the observation.

Suggested endpoint: `POST /api/explain`, accepting the analysis event and returning the explanation. Serve frontend and endpoint from the same local service if practical. A server-side provider adapter keeps provider-specific code in one place.

## 7. Scenario and recommendation rules

| Scenario | Data story | Expected result |
|---|---|---|
| Normal warm-up | Temperature rises from a cool start, then stabilizes | Explain the observed warm-up; do not claim the entire car is healthy |
| Sustained temperature rise | Temperature continues rising beyond the chosen demo baseline for a sustained window | Show an attention/urgent condition under documented demo rules, the trend, a reviewed next step, and uncertainty about cause |
| Prolonged idling — optional | Speed remains zero while RPM indicates the engine is running | Explain the stationary running-engine period without invented fuel or cost savings |

Put thresholds, minimum duration, recovery behavior, and approved next steps in one reviewed configuration. They are prototype scenario rules, not calibrated limits for every vehicle. Avoid alerts on every tick: preserve one active event until the condition meaningfully changes. Reset must clear readings, timers, alerts, and pending explanation ownership.

For urgent-temperature copy, use guidance reviewed against an authoritative vehicle reference. Do not generate repair procedures from the model. If that review cannot be completed, keep the demo focused on explaining the observed trend and directing the user to the vehicle's warning guidance.

## 8. Three-person ownership

Assign by familiarity, not seniority. One person owns each file to avoid conflicts.

| Owner | Responsibility | Initial files / boundaries | First handoff |
|---|---|---|---|
| A — data and analysis | Units fix, simulator, reading validation, trend rules, scenario fixtures | New `js/simulation.js`, `js/insight-engine.js`; existing mock/protocol edits as needed | Emit agreed readings and analysis events |
| B — explanation service | Server setup, model request, response validation, timeout, template explanations | New server files, dependency manifest, environment example; no UI edits | Return an explanation for a fixture event |
| C — experience and integration | Demo entry point, controls, dashboard, chart, recommendation card, integration, demo script | `index.html`, `css/styles.css`, `js/app.js`; coordinates cache changes | Render a fixture reading/event/explanation |

Only C edits `js/app.js` during the initial split. A and B expose small functions/modules and send interface changes to the team before changing them. C is the integration owner; all three verify the final flow. All work is integrated into `test`.

If everyone shares one checkout, use the file boundaries above. If teammates have separate clones, use short-lived branches from the latest `test` and merge small completed changes into `test` frequently. Do not wait until the end to combine work.

## 9. First 20 minutes

1. **Together, 0–5:** Confirm the deadline, assign A/B/C names, read sections 1–4, and accept the two required scenarios. Put this file in the repo as `PROJECT_BRIEF.md`.
2. **Together, 5–10:** Pull the latest `test`, run the current app, record the startup instructions, and confirm which model credentials are available. Do not paste secrets into chat or commit them.
3. **Together, 10–15:** Freeze the interfaces above and agree on module exports, demo thresholds, scenario duration, and reviewed next-step wording.
4. **A, 15–20:** Fix coolant units and produce one repeatable reading sequence.
5. **B, 15–20:** Create the endpoint with a fixture/template response first, then connect the model.
6. **C, 15–20:** Add the independent simulation action and render a fixture recommendation card.

At minute 20, each person should be able to show a small working piece using the same contract.

## 10. Four-hour schedule and checkpoints

| Elapsed time | A | B | C | Required checkpoint |
|---|---|---|---|---|
| 0–20 min | Units and fixture | Endpoint scaffold | Simulation entry and fixture UI | Interfaces agreed; current app runs |
| 20–60 min | Two scenario streams and rules | Template response, then model integration | Controls, readings, recommendation card | First integration at minute 45 |
| 60–90 min | Validate trends and reset | Validate outputs and failure handling | Connect live stream and explanation | Complete normal → concerning trend → recommendation flow |
| 90–140 min | Tune scenarios; optional idling only if ahead | Grounding and timeout checks | Evidence chart, readable wording | Required scope complete |
| 140–180 min | Scenario checks | API failure checks | Fresh-load and replay checks | Verified demo; optional work stops |
| 180–210 min | Help fix blockers | Help fix blockers | Record demo and finalize story | Backup recording saved; build frozen |
| 210–240 min | Rehearse | Rehearse | Rehearse | Presentation-ready; only critical fixes |

If behind at minute 90, stop work on all optional features. If the model is unreliable, retain the verified template path with honest labeling and explain the model integration's status. Reserve the final 30 minutes for rehearsal even if features remain unfinished.

## 11. Definition of done

- [ ] Simulation starts without Bluetooth hardware or API support.
- [ ] Normal and temperature-rise scenarios produce repeatable, distinct outcomes.
- [ ] Coolant and speed units match across generation, analysis, and display.
- [ ] Normal warm-up does not trigger the concerning-temperature scenario rule.
- [ ] Recommendations identify the actual supporting values and duration.
- [ ] Missing or stale data is visible and does not become zero or “healthy.”
- [ ] Explanations avoid unsupported component diagnoses and confidence scores.
- [ ] API failures produce a labeled template explanation without freezing readings.
- [ ] Late AI responses cannot overwrite the current scenario's result.
- [ ] Pause, reset, and replay work without duplicate timers or stale alerts.
- [ ] UI visibly labels simulation and explanation source.
- [ ] Fresh reload shows the latest code; check the existing service-worker cache.
- [ ] No API keys are committed or exposed to the browser.
- [ ] A teammate can launch the demo from the written startup instructions.
- [ ] A backup recording exists and the team has rehearsed.

## 12. Presentation story

1. **Problem:** A driver can see numbers and warning lights without understanding their meaning or urgency.
2. **User:** A first-time owner who wants an understandable explanation and a useful next step.
3. **Demo:** Start normal warm-up, then replay the temperature-rise scenario. Show the evidence before reading the explanation.
4. **How it works:** Simulated OBD-style readings feed documented rules; AI translates the evidence into plain language.
5. **Trust:** Explain simulation, uncertainty, rule ownership, and fallback behavior honestly.
6. **Impact:** Demonstrate understanding. If possible, ask a few people unfamiliar with cars to explain the observed condition and next step; report the small sample accurately.
7. **Next:** Real adapter integration, vehicle-specific validation, and broader usability testing.

Do not claim real-car validation, proven cost savings, prevention of breakdowns, or universal diagnostic accuracy.

## 13. Team decision log

Fill these in during kickoff, then update only when a decision changes.

- Actual presentation deadline:
- Owner A / B / C names:
- Integration owner: C
- Model provider and credentials confirmed by:
- Agreed local startup command:
- Required scenario durations and rule configuration location:
- Next-step wording reviewed by / source:
- First integration checkpoint time:
- Final build-freeze time:
- Current blocker and owner:

**Working agreement:** Prefer a complete, understandable demo over extra features. A change is complete when it works in the shared demo, not only in one person's isolated module.

## Repository references

- Working branch: https://github.com/Isjamal-stack/secondlook_hackachusetts/tree/test
- Reviewed mock transport: https://github.com/Isjamal-stack/secondlook_hackachusetts/blob/7819c45411a45fd451fdf1a1f02de7d9f1e5e08c/js/bluetooth-manager.js
- Reviewed application: https://github.com/Isjamal-stack/secondlook_hackachusetts/blob/7819c45411a45fd451fdf1a1f02de7d9f1e5e08c/js/app.js
- Reviewed decoder: https://github.com/Isjamal-stack/secondlook_hackachusetts/blob/7819c45411a45fd451fdf1a1f02de7d9f1e5e08c/js/elm327-protocol.js
