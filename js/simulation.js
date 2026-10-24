import { createInsightEngine, validateReading } from './insight-engine.js';

/** Time-compressed, deterministic demo fixtures. Celsius throughout. */
export const SCENARIOS = Object.freeze({
    'normal-warmup': Object.freeze({ duration_s: 45, description: 'Warm from 40 °C to a stable 90 °C.' }),
    'temperature-rise': Object.freeze({ duration_s: 45, description: 'Hold 92 °C, then rise steadily to 112 °C.' })
});
const round = n => Math.round(n * 10) / 10;
export function readingAt(scenario_id, elapsed_s, timestamp_ms = Date.now()) {
    const scenario = SCENARIOS[scenario_id];
    if (!scenario) throw new Error(`Unknown scenario: ${scenario_id}`);
    if (!Number.isInteger(elapsed_s) || elapsed_s < 0 || elapsed_s > scenario.duration_s) throw new Error('Invalid scenario time');
    const speed = Math.min(40, elapsed_s * 4);
    const coolant = scenario_id === 'normal-warmup'
        ? Math.min(90, 40 + elapsed_s * 2.5)
        : 92 + Math.min(20, Math.max(0, elapsed_s - 10) * 0.8);
    return { scenario_id, timestamp_ms, elapsed_s, source: 'simulation',
        rpm: speed === 0 ? 850 : 1000 + speed * 25, speed_kmh: speed,
        coolant_c: round(coolant), engine_load_pct: speed === 0 ? 18 : speed < 40 ? 48 : 36 };
}

/** Matches Person C's synchronous controller factory exactly. No callbacks during construction. */
export function createSimulation({ scenario_id, run_id, onReading, onAnalysis, onComplete = () => {},
    clock = () => Date.now(), scheduler = globalThis }) {
    if (!SCENARIOS[scenario_id]) throw new Error(`Unknown scenario: ${scenario_id}`);
    if (typeof run_id !== 'string' || !run_id) throw new Error('A unique run_id is required');
    if (typeof onReading !== 'function' || typeof onAnalysis !== 'function') throw new Error('Reading and analysis callbacks are required');
    const engine = createInsightEngine({ scenario_id, run_id });
    let timer = null, elapsed = 0, complete = false, running = false, generation = 0;
    function pause() {
        running = false;
        generation++;
        if (timer !== null) scheduler.clearInterval(timer);
        timer = null;
    }
    function tick() {
        if (!running || complete) return;
        const token = generation;
        const now = clock();
        const { reading } = validateReading(readingAt(scenario_id, elapsed, now));
        const event = engine.analyze(reading, now);
        elapsed++;
        onReading(reading);
        if (token !== generation) return;
        if (event) onAnalysis(event);
        if (token !== generation) return;
        if (elapsed > SCENARIOS[scenario_id].duration_s) {
            complete = true;
            pause();
            onComplete();
        }
    }
    return {
        start() {
            if (running || complete) return;
            running = true;
            const token = ++generation;
            timer = scheduler.setInterval(() => { if (token === generation) tick(); }, 1000);
            if (elapsed === 0) tick();
        },
        pause,
        reset() { pause(); elapsed = 0; complete = false; engine.reset(); }
    };
}
