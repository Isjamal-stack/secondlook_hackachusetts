/** Prototype rules for simulated scenarios, NOT universal vehicle limits. */
export const RULES = Object.freeze({
    window_s: 10, stale_ms: 3000, max_gap_s: 2,
    rise_baseline_c: 92, rise_end_c: 100, rise_delta_c: 4,
    normal_min_c: 85, normal_max_c: 94, stable_range_c: 2,
    recovery_s: 15,
    next_steps: Object.freeze({
        normal_warmup: 'Keep watching the temperature as the trip continues. This pattern does not assess the whole vehicle.',
        sustained_temperature_rise: 'Check the temperature warning guidance in your vehicle’s handbook and discuss a continuing rise with a mechanic.',
        insufficient_data: 'Wait for a complete recent reading window before interpreting the trend.',
        data_unavailable: 'Check the data source and wait for complete, recent readings. Missing data cannot establish vehicle condition.'
    })
});
export const LIMITATIONS = Object.freeze([
    'Simulated data and prototype scenario rules; thresholds are not calibrated for every vehicle.',
    'Exact mechanical cause cannot be determined from these readings.'
]);
const ranges = { rpm: [0, 10000], speed_kmh: [0, 300], coolant_c: [-40, 215], engine_load_pct: [0, 100] };

/** Never coerce null, strings, NaN, or out-of-range measurements into zero. */
export function validateReading(input) {
    const reading = { ...(input || {}) };
    const issues = [];
    for (const [metric, [min, max]] of Object.entries(ranges)) {
        if (!Number.isFinite(reading[metric]) || reading[metric] < min || reading[metric] > max) {
            reading[metric] = null;
            issues.push(metric);
        }
    }
    if (!Number.isFinite(reading.timestamp_ms) || reading.timestamp_ms < 0) issues.push('timestamp_ms');
    if (!Number.isFinite(reading.elapsed_s) || reading.elapsed_s < 0) issues.push('elapsed_s');
    if (reading.source !== 'simulation') issues.push('source');
    if (typeof reading.scenario_id !== 'string' || !reading.scenario_id) issues.push('scenario_id');
    return { reading, issues };
}

export function createInsightEngine({ scenario_id, run_id }) {
    let readings = [], active = null, sequence = 0, lastElapsed = null;
    function emit(condition, evidence, observed_at_ms) {
        if (condition === active) return null;
        active = condition;
        return {
            event_id: `${run_id}-${scenario_id}-${++sequence}`, scenario_id, condition,
            urgency: condition === 'normal_warmup' ? 'normal' : condition === 'sustained_temperature_rise' ? 'attention' : 'unknown',
            observed_at_ms, evidence, limitations: [...LIMITATIONS],
            approved_next_step: RULES.next_steps[condition]
        };
    }
    function reset() { readings = []; active = null; lastElapsed = null; /* IDs are never reused. */ }
    function analyze(input, now_ms = Date.now()) {
        const { reading: r, issues } = validateReading(input);
        const invalid = issues.length || r.scenario_id !== scenario_id ||
            now_ms - r.timestamp_ms > RULES.stale_ms || r.timestamp_ms > now_ms ||
            (lastElapsed !== null && r.elapsed_s <= lastElapsed);
        if (invalid) {
            readings = [];
            return emit('data_unavailable', [], now_ms);
        }
        if (lastElapsed !== null && r.elapsed_s - lastElapsed > RULES.max_gap_s) readings = [];
        lastElapsed = r.elapsed_s;
        readings.push(r);
        readings = readings.filter(p => r.elapsed_s - p.elapsed_s <= RULES.recovery_s);
        const window = readings.filter(p => r.elapsed_s - p.elapsed_s <= RULES.window_s);
        const first = window[0];
        const duration = r.elapsed_s - first.elapsed_s;
        const evidence = [{ metric: 'coolant_c', start_value: first.coolant_c, end_value: r.coolant_c, duration_s: duration }];
        if (duration < RULES.window_s) return emit('insufficient_data', evidence, r.timestamp_ms);
        const values = window.map(p => p.coolant_c);
        const sustained = first.coolant_c >= RULES.rise_baseline_c && r.coolant_c >= RULES.rise_end_c &&
            r.coolant_c - first.coolant_c >= RULES.rise_delta_c &&
            values.every((v, i) => !i || v >= values[i - 1] - 0.5);
        if (sustained) return emit('sustained_temperature_rise', evidence, r.timestamp_ms);
        const recovery = active === 'sustained_temperature_rise';
        const stableWindow = recovery ? readings : window;
        const stableValues = stableWindow.map(p => p.coolant_c);
        const stable = stableValues.every(v => v >= RULES.normal_min_c && v <= RULES.normal_max_c) &&
            Math.max(...stableValues) - Math.min(...stableValues) <= RULES.stable_range_c &&
            r.elapsed_s - stableWindow[0].elapsed_s >= (recovery ? RULES.recovery_s : RULES.window_s);
        if (stable) return emit('normal_warmup', [{ metric: 'coolant_c', start_value: stableWindow[0].coolant_c,
            end_value: r.coolant_c, duration_s: r.elapsed_s - stableWindow[0].elapsed_s }], r.timestamp_ms);
        // Retain an attention event until a full recovery window, rather than flickering each tick.
        return recovery ? null : emit('insufficient_data', evidence, r.timestamp_ms);
    }
    return { analyze, reset };
}
