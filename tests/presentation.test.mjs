import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, createInsightEngine } from '../js/insight-engine.js';
import { readingAt } from '../js/simulation.js';
import { describeRule, locateFinding, summarizeTrip } from '../js/demo-presentation.js';

function scenario(id) {
    const engine = createInsightEngine({ scenario_id: id, run_id: 'presentation' });
    const readings = [], events = [];
    for (let t = 0; t <= 45; t++) {
        const reading = readingAt(id, t, 1700000000000 + t * 1000 + (t > 15 ? 60000 : 0));
        readings.push(reading);
        const event = engine.analyze(reading, reading.timestamp_ms);
        if (event) events.push(event);
    }
    return { readings, events };
}

test('rule explanations track the imported configuration, including recovery and existing step tolerance', () => {
    const { events } = scenario('temperature-rise');
    const rise = events.find(e => e.urgency === 'attention');
    const rules = { ...RULES, window_s: 17, rise_baseline_c: 87, rise_end_c: 109, rise_delta_c: 9, rise_step_tolerance_c: 0.7,
        normal_min_c: 81, normal_max_c: 96, stable_range_c: 3, recovery_s: 21 };
    const text = describeRule(rise, rules);
    for (const value of ['17 s', '87 °C', '109 °C', '9 °C', '0.7 °C', '8 °C over 10 s', 'demo rules']) assert.ok(text.includes(value), value);
    const stable = describeRule(events.find(e => e.urgency === 'normal'), rules);
    for (const value of ['81 and 96 °C', '3 °C', '17 s', '21 s']) assert.ok(stable.includes(value), value);
});

test('marker uses the trigger timestamp and elapsed observation window across a pause', () => {
    const { readings, events } = scenario('temperature-rise');
    const event = events.find(e => e.urgency === 'attention');
    const marker = locateFinding(event, readings);
    assert.equal(marker.x, 20); assert.equal(marker.y, 100); assert.equal(marker.start_s, 10);
    assert.equal(marker.points.length, 11);
    assert.equal(readings.at(-1).coolant_c, 112);
    assert.equal(locateFinding({ ...event, observed_at_ms: event.observed_at_ms + 1 }, readings), null);
    assert.equal(locateFinding(event, readings.filter(r => r.elapsed_s !== 10)), null);
    assert.equal(locateFinding({ ...event, evidence: [{ ...event.evidence[0], end_value: 999 }] }, readings), null);
});

test('summary preserves attention history after recovery and keeps approved actions per finding', () => {
    const { readings, events } = scenario('temperature-rise');
    const attention = events.find(e => e.urgency === 'attention');
    const stable = events.find(e => e.urgency === 'normal');
    const summary = summarizeTrip([
        { event: attention, elapsed_s: locateFinding(attention, readings).x },
        { event: stable, elapsed_s: 40 }
    ]);
    assert.match(summary.title, /attention finding was recorded/);
    assert.ok(summary.details.includes(attention.approved_next_step));
    assert.match(summary.details, /At 20 s: 92 → 100 °C over 10 s/);
    const noAnalysis = summarizeTrip([]);
    assert.match(noAnalysis.title, /No attention finding was recorded/);
    assert.match(noAnalysis.next_step, /No analysis was recorded/);
});
