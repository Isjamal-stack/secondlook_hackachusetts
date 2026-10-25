/** Presentation only: explain A's decisions; never recompute or override a finding. */
import { RULES } from './insight-engine.js?v=secondlook-understand-5';

// Editorial review: Ford coolant guide and OTC CP9190 scan-tool definitions.
// Sources and review scope are recorded in DEMO_INTEGRATION.md.
export const GLOSSARY = Object.freeze({
    coolant: 'The temperature of the fluid that carries heat away from the engine. A reading does not tell us whether every cooling part is working.',
    load: 'A calculated percentage indicating how much work the engine is doing. It is not a percentage of engine wear or a health score.',
    rpm: 'Revolutions per minute: how many turns the engine makes in a minute.',
    window: 'The stretch of recent readings used for a finding. Its evidence stays fixed even as new readings arrive.'
});
const n = value => Number.isFinite(value) ? String(Number(value.toFixed(1))) : '—';
export function findingStatus(event) {
    return ({ insufficient_data: 'Collecting readings', normal_warmup: 'Temperature steady',
        sustained_temperature_rise: 'Temperature rising', data_unavailable: 'Readings unavailable' })[event?.condition]
        || (event ? 'Readings unavailable' : 'Collecting readings');
}

export function describeRule(event, rules = RULES) {
    const item = event.evidence.find(item => item.metric === 'coolant_c');
    const scope = 'These are demo rules, not temperature limits for every vehicle.';
    if (event.condition === 'sustained_temperature_rise' && item) {
        return `The observed increase was ${n(item.end_value - item.start_value)} °C over ${n(item.duration_s)} s. ` +
            `The demo rule requires at least ${n(rules.window_s)} s of readings, a starting temperature of at least ${n(rules.rise_baseline_c)} °C, ` +
            `an ending temperature of at least ${n(rules.rise_end_c)} °C, and a rise of at least ${n(rules.rise_delta_c)} °C. ` +
            `It also checks that no reading drops more than ${n(rules.rise_step_tolerance_c)} °C from the previous reading. ${scope}`;
    }
    if (event.condition === 'normal_warmup' && item) {
        return `This finding used ${n(item.duration_s)} s of readings. The demo's steady rule requires all readings to stay between ` +
            `${n(rules.normal_min_c)} and ${n(rules.normal_max_c)} °C, with at most ${n(rules.stable_range_c)} °C between the highest and lowest. ` +
            `It requires at least ${n(rules.window_s)} s, or ${n(rules.recovery_s)} s when clearing an active temperature-rise finding. ${scope}`;
    }
    if (event.condition === 'insufficient_data') {
        return `The detector has not yet matched a steady or rising pattern. It needs at least ${n(rules.window_s)} s of complete recent readings; after a rise, a steady finding needs ${n(rules.recovery_s)} s. ${scope}`;
    }
    if (event.condition === 'data_unavailable') {
        return `The detector reported missing, invalid, or out-of-order readings. It also checks for readings older than ${n(rules.stale_ms / 1000)} s or gaps greater than ${n(rules.max_gap_s)} s. The event does not identify which check failed.`;
    }
    return 'No description is available for this rule. The supplied evidence and limitations still apply.';
}

/** Exact timestamp/value anchors only. A pause can create gaps in wall-clock time,
 * so the supporting window is located using the matched reading's elapsed time. */
export function locateFinding(event, readings) {
    const item = event.evidence.find(item => item.metric === 'coolant_c');
    if (!item || !Number.isFinite(item.duration_s) || item.duration_s < 0) return null;
    const end = readings.find(r => r.scenario_id === event.scenario_id && r.timestamp_ms === event.observed_at_ms &&
        Number.isFinite(r.coolant_c) && r.coolant_c === item.end_value);
    if (!end) return null;
    const start_s = end.elapsed_s - item.duration_s;
    const window = readings.filter(r => r.scenario_id === event.scenario_id && r.elapsed_s >= start_s && r.elapsed_s <= end.elapsed_s);
    if (!window.length || window[0].elapsed_s !== start_s || window[0].coolant_c !== item.start_value ||
        !window.every(r => Number.isFinite(r.coolant_c))) return null;
    return { x: end.elapsed_s, y: end.coolant_c, start_s,
        points: window.map(r => ({ x: r.elapsed_s, y: r.coolant_c })) };
}

export function summarizeTrip(records) {
    const attention = records.filter(record => ['attention', 'urgent'].includes(record.event.urgency));
    if (!attention.length) return {
        title: 'No attention finding was recorded',
        details: 'This applies only to this simulated run. It does not establish the condition of the whole vehicle.',
        next_step: records.at(-1)?.event.approved_next_step || 'No analysis was recorded. Wait for complete readings before interpreting a trend.'
    };
    return {
        title: `${attention.length === 1 ? 'An attention finding was' : `${attention.length} attention findings were`} recorded`,
        details: attention.map(({ event, elapsed_s }) => {
            const evidence = event.evidence.filter(item => item.metric === 'coolant_c')
                .map(item => `${n(item.start_value)} → ${n(item.end_value)} °C over ${n(item.duration_s)} s`).join('; ');
            return `${elapsed_s === null ? 'Time unavailable' : `At ${n(elapsed_s)} s`}: ${evidence || 'No coolant evidence supplied'}. Next step: ${event.approved_next_step}`;
        }).join(' '),
        next_step: '' // Each recorded finding keeps its own approved action above.
    };
}
