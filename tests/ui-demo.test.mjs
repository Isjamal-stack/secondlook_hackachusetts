/** Focused DOM harness; not a substitute for a visual browser check. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createSimulation } from '../js/simulation.js';
import * as presentation from '../js/demo-presentation.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const explanationFor = (event, source = 'template') => ({
    event_id: event.event_id, title: 'Observed window', explanation: 'The evidence describes this observed window only.',
    next_step: event.approved_next_step, limitation: event.limitations.join(' '), explanation_source: source
});
function harness(explain = event => Promise.resolve(explanationFor(event))) {
    let now = 1700000000000, sequence = 0;
    const timers = new Map(), runIds = [];
    const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
        textContent: '', value: id === 'demo-scenario' ? 'normal-warmup' : '', dataset: {},
        listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
        removeAttribute(name) { if (name === 'data-urgency') delete this.dataset.urgency; }
    }]));
    const scheduler = {
        setInterval(fn) { timers.set(++sequence, fn); return sequence; },
        clearInterval(id) { timers.delete(id); }
    };
    const context = vm.createContext({
        ...presentation, console: { log() {} }, window: {}, crypto: webcrypto, AbortController, setTimeout, clearTimeout,
        document: { addEventListener() {}, getElementById: id => elements.get(id), querySelector: () => ({ textContent: '' }) },
        createExamplePreview() { throw new Error('Examples should not be the integrated default'); },
        createSimulation(options) {
            runIds.push(options.run_id);
            return createSimulation({ ...options, scheduler, clock: () => now });
        },
        Chart: class { constructor(canvas, config) { Object.assign(this, config); } update() {} }
    });
    vm.runInContext(appSource.replace(/^import .*;\n/gm, '').replaceAll('export ', '') + '\ninitializeDemo(); configureDemo({ createSimulation });', context);
    const ui = context.window.secondLookUI;
    ui.configure({ explain });
    return { ui, runIds, el: id => elements.get(id), state: expr => vm.runInContext(expr, context),
        step(count) { for (let i = 0; i < count; i++) { now += 1000; [...timers.values()].forEach(tick => tick()); } }
    };
}

test('both integrated scenarios display rule evidence, source labels, chart, and clear on Reset', async () => {
    for (const [scenario, seconds, evidence, urgency, source] of [
        ['normal-warmup', 30, /90 → 90 °C/, 'normal', 'ai'],
        ['temperature-rise', 20, /92 → 100 °C/, 'attention', 'template']
    ]) {
        const h = harness(event => Promise.resolve(explanationFor(event, source)));
        h.el('demo-scenario').value = scenario;
        h.ui.start(); h.ui.start();
        h.step(2); h.ui.pause();
        const paused = h.el('coolant-value').textContent;
        h.step(3); assert.equal(h.el('coolant-value').textContent, paused);
        h.ui.start(); h.step(seconds - 2);
        await flush();
        assert.match(h.el('recommendation-evidence').textContent, evidence);
        assert.equal(h.el('finding-duration').textContent, 'Coolant temperature: 10 s');
        assert.equal(h.el('recommendation-card').dataset.urgency, urgency);
        assert.match(h.el('explanation-source').textContent, source === 'ai' ? /AI explanation/ : /Template explanation/);
        assert.equal(h.state('demo.chart.data.datasets[0].data.length'), seconds + 1);
        h.ui.reset();
        assert.equal(h.el('coolant-value').textContent, '—');
        assert.equal(h.el('finding-rule').textContent, 'Waiting for analysis.');
        assert.equal(h.state('demo.chart.data.datasets[0].data.length'), 0);
    }
});

test('endpoint failure leaves labeled fallback while readings continue', async () => {
    const h = harness(() => Promise.reject(new Error('Service unavailable')));
    h.ui.start(); h.step(30); await flush();
    assert.match(h.el('explanation-source').textContent, /Template explanation/);
    assert.equal(h.el('coolant-value').textContent, '90');
    h.ui.reset();
});

test('Reset during explanation request ignores the late answer', async () => {
    const pending = [];
    const h = harness(event => new Promise(resolve => pending.push(() => resolve(explanationFor(event, 'ai')))));
    h.ui.start(); h.step(30);
    h.ui.reset(); pending.forEach(resolve => resolve()); await flush();
    assert.equal(h.el('explanation-source').textContent, 'No explanation yet');
    assert.equal(h.el('recommendation-observation').textContent, 'No readings yet.');
    assert.equal(h.el('trip-summary').hidden, true);
    assert.equal(h.state('demo.chart.data.datasets.length'), 3);
    assert.equal(h.state('demo.events.length'), 0);
});

test('new page sessions and new runs have different event prefixes', async () => {
    const first = harness(), second = harness();
    first.ui.start(); second.ui.start();
    assert.notEqual(first.runIds[0], second.runIds[0]);
    first.ui.reset(); first.ui.start();
    assert.notEqual(first.runIds[0], first.runIds[1]);
    first.ui.reset(); second.ui.reset(); await flush();
});

test('unfinished pages are hidden, disabled, inert, and false success messages are gone', () => {
    for (const page of ['connect', 'diagnostics', 'history', 'maintenance', 'settings']) {
        assert.match(html, new RegExp(`data-view="${page}" hidden disabled`));
        assert.match(html, new RegExp(`id="${page}-view" hidden inert`));
    }
    assert.doesNotMatch(html, /No active trouble codes/);
    assert.doesNotMatch(appSource, /Imported .*successfully/);
    assert.match(appSource, /if \(viewName !== 'dashboard'\) return/);
});


test('status follows A’s event and cannot be overwritten by an AI title', async () => {
    const h = harness(event => Promise.resolve({ ...explanationFor(event, 'ai'), title: 'An unrelated title' }));
    assert.equal(h.el('recommendation-title').textContent, 'Collecting readings');
    h.ui.start(); h.step(30); await flush();
    assert.equal(h.el('recommendation-title').textContent, 'Temperature steady');
    const event = h.state('demo.event');
    h.ui.renderAnalysis({ ...event, event_id: 'unavailable', condition: 'data_unavailable', urgency: 'unknown', evidence: [] });
    assert.equal(h.el('recommendation-title').textContent, 'Readings unavailable');
    assert.equal(h.el('recommendation-card').dataset.urgency, 'unknown');
    h.ui.reset(); await flush();
});

test('chart marks actual trigger values, keeps frozen windows, and completes an accurate attention summary', async () => {
    const h = harness(); h.el('demo-scenario').value = 'temperature-rise'; h.ui.start(); h.step(45); await flush();
    assert.equal(h.el('coolant-value').textContent, '112');
    assert.equal(h.el('recommendation-title').textContent, 'Temperature rising');
    const marker = h.state('demo.chart.data.datasets[2].data[0]');
    assert.equal(marker.x, 20); assert.equal(marker.y, 100);
    const window = h.state('demo.chart.data.datasets.at(-1).data');
    assert.equal(window[0].x, 10); assert.equal(window[0].y, 92);
    assert.equal(window.at(-1).x, 20); assert.equal(window.at(-1).y, 100);
    assert.match(h.el('chart-findings').textContent, /Temperature rising at 20 s.*10–20 s/);
    assert.equal(h.el('trip-summary').hidden, false);
    assert.match(h.el('trip-summary-title').textContent, /attention finding was recorded/);
    assert.match(h.el('trip-summary-details').textContent, /At 20 s: 92 → 100 °C over 10 s/);
    assert.ok(h.el('trip-summary-details').textContent.includes(h.state('demo.event.approved_next_step')));
    h.ui.start(); // Replay resets all previous artifacts before emitting the new first row.
    assert.equal(h.el('trip-summary').hidden, true);
    assert.equal(h.el('trip-summary-details').textContent, '');
    assert.equal(h.state('demo.chart.data.datasets.length'), 3);
    assert.equal(h.state('demo.chart.data.datasets[2].data.length'), 0);
    assert.equal(h.state('demo.events.length'), 1); // Only the new collecting event.
    h.ui.reset(); await flush();
});

test('normal trip summary is narrow, with a steady marker at 30 s; scenario change clears it', async () => {
    const h = harness(); h.ui.start(); h.step(45); await flush();
    assert.match(h.el('trip-summary-title').textContent, /No attention finding was recorded/);
    assert.match(h.el('trip-summary-details').textContent, /does not establish/);
    assert.equal(h.state('demo.chart.data.datasets[1].data[0].x'), 30);
    assert.equal(h.state('demo.chart.data.datasets[1].data[0].y'), 90);
    h.el('demo-scenario').value = 'temperature-rise'; h.el('demo-scenario').listeners.change();
    assert.equal(h.el('trip-summary').hidden, true);
    assert.equal(h.state('demo.events.length'), 0);
    assert.equal(h.state('demo.chart.data.datasets[1].data.length'), 0);
});
