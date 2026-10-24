import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, readingAt } from '../js/simulation.js';
import { createInsightEngine, validateReading } from '../js/insight-engine.js';
import { BluetoothManager } from '../js/bluetooth-manager.js';
import { ELM327Protocol } from '../js/elm327-protocol.js';
const base = 1700000000000;
const row = (t, coolant = 90) => ({ ...readingAt('normal-warmup', Math.min(t, 45), base + t * 1000), elapsed_s: t, coolant_c: coolant });
const engine = () => createInsightEngine({ scenario_id: 'normal-warmup', run_id: 'test' });
function run(scenario_id) {
    const e = createInsightEngine({ scenario_id, run_id: 'fixture' });
    const events = [];
    for (let t = 0; t <= 45; t++) {
        const reading = readingAt(scenario_id, t, base + t * 1000);
        const event = e.analyze(reading, reading.timestamp_ms);
        if (event) events.push(event);
    }
    return events;
}
test('normal warms then stabilizes, never triggers attention', () => {
    const events = run('normal-warmup');
    assert.deepEqual(events.map(e => e.urgency), ['unknown', 'normal']);
    assert.equal(events[1].observed_at_ms, base + 30000);
    assert.deepEqual(events[1].evidence, [{ metric: 'coolant_c', start_value: 90, end_value: 90, duration_s: 10 }]);
});
test('rise uses an actual sustained window and emits only once', () => {
    const events = run('temperature-rise');
    assert.deepEqual(events.map(e => e.condition), ['insufficient_data', 'normal_warmup', 'insufficient_data', 'sustained_temperature_rise']);
    const alert = events.at(-1);
    assert.equal(alert.urgency, 'attention');
    assert.equal(alert.observed_at_ms, base + 20000);
    assert.deepEqual(alert.evidence, [{ metric: 'coolant_c', start_value: 92, end_value: 100, duration_s: 10 }]);
    assert.deepEqual(run('temperature-rise'), events);
});
test('missing and invalid measurements remain null, never healthy', () => {
    for (const metric of ['rpm', 'speed_kmh', 'coolant_c', 'engine_load_pct']) {
        for (const bad of [null, undefined, NaN, Infinity, '90', 99999]) {
            const input = { ...row(0), [metric]: bad };
            assert.equal(validateReading(input).reading[metric], null);
            assert.equal(engine().analyze(input, base).urgency, 'unknown');
        }
    }
});
test('stale, future, wrong-source and duplicate readings invalidate the window', () => {
    const e = engine();
    assert.equal(e.analyze(row(0), base + 3001).condition, 'data_unavailable');
    assert.equal(engine().analyze(row(0), base - 1).condition, 'data_unavailable');
    assert.equal(engine().analyze({ ...row(0), source: 'real' }, base).condition, 'data_unavailable');
    const fresh = engine(); fresh.analyze(row(0), base);
    assert.equal(fresh.analyze(row(0), base).condition, 'data_unavailable');
});
test('a gap or missing sample requires rebuilding the full window', () => {
    const e = engine();
    for (let t = 0; t <= 10; t++) e.analyze(row(t), base + t * 1000);
    assert.equal(e.analyze(row(15), base + 15000).urgency, 'unknown');
    assert.equal(e.analyze({ ...row(16), coolant_c: null }, base + 16000).condition, 'data_unavailable');
    for (let t = 17; t < 27; t++) {
        const result = e.analyze(row(t), base + t * 1000);
        assert.notEqual(result?.urgency, 'normal');
    }
    assert.equal(e.analyze(row(27), base + 27000).urgency, 'normal');
});
test('a single spike does not count as sustained rise; recovery takes 15 s', () => {
    const e = engine();
    for (let t = 0; t <= 10; t++) {
        const event = e.analyze(row(t, t === 5 ? 110 : 92), base + t * 1000);
        assert.notEqual(event?.urgency, 'attention');
    }
    const rising = engine();
    for (let t = 0; t <= 10; t++) rising.analyze(row(t, 92 + t), base + t * 1000);
    for (let t = 11; t <= 25; t++) assert.equal(rising.analyze(row(t), base + t * 1000), null);
    assert.equal(rising.analyze(row(26), base + 26000).urgency, 'normal');
});
test('controller has no constructor emissions, duplicate timers, or pause/reset leaks', () => {
    let now = base, nextId = 0, completed = 0;
    const timers = new Map(), rows = [], events = [];
    const scheduler = { setInterval(fn) { timers.set(++nextId, fn); return nextId; }, clearInterval(id) { timers.delete(id); } };
    const c = createSimulation({ scenario_id: 'normal-warmup', run_id: 'controller', clock: () => now, scheduler,
        onReading: r => rows.push(r), onAnalysis: e => events.push(e), onComplete: () => completed++ });
    assert.equal(rows.length, 0);
    c.start(); c.start();
    assert.equal(timers.size, 1); assert.equal(rows.length, 1);
    const oldTick = [...timers.values()][0];
    now += 1000; oldTick();
    c.pause(); now += 60000; oldTick();
    assert.equal(rows.length, 2); assert.equal(timers.size, 0);
    c.start(); assert.equal(rows.length, 2);
    oldTick(); assert.equal(rows.length, 2);
    const resumedTick = [...timers.values()][0];
    now += 1000; resumedTick();
    assert.equal(rows.at(-1).elapsed_s, 2); assert.equal(rows.at(-1).timestamp_ms, now);
    c.reset(); resumedTick(); assert.equal(rows.length, 3);
    c.start(); assert.equal(rows.at(-1).elapsed_s, 0);
    assert.notEqual(events[0].event_id, events.at(-1).event_id);
    for (let i = 0; i < 45; i++) { now += 1000; [...timers.values()][0](); }
    assert.equal(completed, 1); assert.equal(timers.size, 0);
    const count = rows.length; c.start(); assert.equal(rows.length, count);
});
test('invalid scenarios fail before scheduling; speed and RPM share a coherent state', () => {
    assert.throws(() => readingAt('missing', 0));
    assert.throws(() => readingAt('normal-warmup', -1));
    assert.throws(() => createSimulation({ scenario_id: 'missing' }));
    assert.equal(readingAt('normal-warmup', 0).speed_kmh, 0);
    assert.equal(readingAt('normal-warmup', 0).rpm, 850);
    assert.equal(readingAt('normal-warmup', 10).rpm, 2000);
});
test('mock coolant round-trips through the real decoder as 90 Celsius', async () => {
    const response = await new BluetoothManager().simulateResponse('0105');
    assert.equal(new ELM327Protocol().parsePIDResponse(response, '05'), 90);
});
test('adapter installs the shared factory without replacing the explanation adapter', async () => {
    const { installSimulation } = await import('../js/simulation-adapter.js');
    let config;
    installSimulation({ configure(value) { config = value; } });
    assert.deepEqual(Object.keys(config), ['createSimulation']);
    assert.equal(config.createSimulation, createSimulation);
    assert.throws(() => installSimulation({}));
});
