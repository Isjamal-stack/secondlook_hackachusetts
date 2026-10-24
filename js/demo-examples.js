/** TEMPORARY UI FIXTURES ONLY. Replace using secondLookUI.configure().
 * Fixed playback, no simulation model, thresholds, or trend detection.
 */
const examples = {
    'normal-warmup': [40, 60, 78, 88, 90, 90],
    'temperature-rise': [92, 95, 98, 102, 105, 108]
};

export function createExamplePreview({ scenario_id, run_id, onReading, onAnalysis, onComplete }) {
    let index = 0;
    let timer = null;
    const started = Date.now();
    const temperatures = examples[scenario_id];
    function tick() {
        const elapsed = index;
        onReading({ scenario_id, timestamp_ms: started + elapsed * 1000, elapsed_s: elapsed,
            source: 'simulation', rpm: 1800, speed_kmh: 30,
            coolant_c: temperatures[index], engine_load_pct: 42 });
        index++;
        if (index === temperatures.length) {
            const rising = scenario_id === 'temperature-rise';
            const event = {
                event_id: `${run_id}-${scenario_id}-example`, scenario_id,
                condition: rising ? 'sustained_temperature_rise' : 'normal_warmup',
                urgency: rising ? 'attention' : 'normal', observed_at_ms: started + elapsed * 1000,
                evidence: [{ metric: 'coolant_c', start_value: temperatures[0], end_value: temperatures[index - 1], duration_s: elapsed }],
                limitations: ['This is a short, scripted example, not a vehicle assessment. The mechanical cause cannot be determined from these readings.'],
                approved_next_step: rising ? 'Check the temperature warning guidance in your vehicle’s handbook and discuss a continuing rise with a mechanic.' : 'Keep watching the temperature as the trip continues.'
            };
            onAnalysis(event, {
                event_id: event.event_id,
                title: rising ? 'Temperature keeps rising in this example' : 'Temperature levels off in this example',
                explanation: rising ? 'A continuing rise can mean the engine is having trouble getting rid of heat. This example illustrates the pattern; it does not diagnose a fault.' : 'Temperature often rises as an engine warms up. Here it levels off, but this does not tell us that the whole car is healthy.',
                next_step: event.approved_next_step, limitation: event.limitations[0], explanation_source: 'template'
            }, { example: true });
            pause();
            onComplete();
        }
    }
    function pause() { clearInterval(timer); timer = null; }
    return {
        start() { if (timer || index === temperatures.length) return; timer = setInterval(tick, 1000); if (index === 0) tick(); },
        pause,
        reset: pause
    };
}
