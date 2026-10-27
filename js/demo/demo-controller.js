/**
 * @fileoverview Demo System Controller
 * @module demo/demo-controller
 * 
 * Manages the complete demo/simulation system UI and state. Coordinates
 * simulation playback, chart updates, AI insight rendering, and user
 * interactions for the demo mode.
 * 
 * Responsibilities:
 * - Demo UI initialization and event handling
 * - Simulation lifecycle management (start, pause, reset)
 * - Real-time data rendering and chart updates
 * - AI explanation integration and display
 * - Finding detection and visualization
 * 
 * @requires demo/demo-examples
 * @requires demo/demo-presentation
 * 
 * @example
 * import { DemoController } from './demo/demo-controller.js';
 * 
 * DemoController.initialize();
 * DemoController.configure({ createSimulation });
 * DemoController.start();
 */

/**
 * Demo Controller Module
 * Manages the demo/simulation UI and state
 * Extracted from app.js to keep demo code organized
 */

import { createExamplePreview } from './demo-examples.js';
import { GLOSSARY, findingStatus, describeRule, locateFinding, summarizeTrip } from './demo-presentation.js';

// Demo session and state
const demoSessionId = crypto.randomUUID();
const demo = {
    run: 0,
    status: 'ready',
    controller: null,
    chart: null,
    reading: null,
    event: null,
    example: false,
    request: null,
    readings: [],
    events: [],
    adapters: {
        createSimulation: createExamplePreview,
        explain: null
    }
};

// Helper functions for DOM manipulation
const demoElement = id => document.getElementById(id);
const demoText = (id, value) => { demoElement(id).textContent = value; };
const numberText = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—';

// Evidence display helpers
const evidenceUnits = { coolant_c: '°C', rpm: 'RPM', speed_kmh: 'km/h', engine_load_pct: '%' };
const evidenceLabels = { coolant_c: 'Coolant temperature', rpm: 'Engine speed', speed_kmh: 'Vehicle speed', engine_load_pct: 'Engine load' };
const metricLabel = metric => evidenceLabels[metric] || metric.replaceAll('_', ' ');

function evidenceText(event, includeDuration = true) {
    return event.evidence.map(item => 
        `${metricLabel(item.metric)}: ${numberText(item.start_value)} → ${numberText(item.end_value)} ${evidenceUnits[item.metric] || ''}${includeDuration ? ` over ${numberText(item.duration_s)} s` : ''}.`
    ).join(' ');
}

/**
 * Initialize demo system
 * Sets up event listeners, chart, and glossary
 */
export function initializeDemo() {
    // Populate glossary
    for (const [term, text] of Object.entries(GLOSSARY)) {
        demoText(`glossary-${term}`, text);
    }
    
    // Attach event listeners
    demoElement('demo-start').addEventListener('click', startDemo);
    demoElement('demo-pause').addEventListener('click', pauseDemo);
    demoElement('demo-reset').addEventListener('click', resetDemo);
    demoElement('demo-scenario').addEventListener('change', resetDemo);
    
    // Initialize Chart.js if available
    if (typeof Chart !== 'undefined') {
        demo.chart = new Chart(demoElement('coolant-trend'), {
            type: 'line',
            data: { 
                datasets: [
                    { 
                        label: 'Coolant temperature (°C)', 
                        data: [], 
                        borderColor: '#1976d2',
                        borderWidth: 2, 
                        pointRadius: 3, 
                        tension: 0, 
                        spanGaps: false, 
                        order: 0 
                    },
                    { 
                        type: 'scatter', 
                        label: 'Steady finding (circle)', 
                        data: [], 
                        pointStyle: 'circle', 
                        pointRadius: 7, 
                        pointHoverRadius: 9, 
                        backgroundColor: '#2e7d32', 
                        order: -1 
                    },
                    { 
                        type: 'scatter', 
                        label: 'Rising finding (triangle)', 
                        data: [], 
                        pointStyle: 'triangle', 
                        pointRadius: 8, 
                        pointHoverRadius: 10, 
                        backgroundColor: '#a65f00', 
                        order: -1 
                    }
                ] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: false,
                plugins: { 
                    legend: { 
                        display: true, 
                        labels: { 
                            usePointStyle: true, 
                            filter: item => item.datasetIndex === 1 || item.datasetIndex === 2 
                        } 
                    }, 
                    tooltip: { 
                        callbacks: {
                            label: item => `${item.raw.finding_label ? item.raw.finding_label + ': ' : ''}${numberText(item.parsed.y)} °C at ${numberText(item.parsed.x)} s`
                        } 
                    } 
                },
                scales: {
                    x: { 
                        type: 'linear', 
                        title: { display: true, text: 'Elapsed time (seconds)' }, 
                        ticks: { precision: 0 } 
                    },
                    y: { 
                        title: { display: true, text: 'Coolant temperature (°C)' } 
                    }
                }
            }
        });
    } else {
        demoText('chart-status', 'Chart library could not load. Connect to the internet and reload; readings still work.');
    }
}

/**
 * Set demo status and update UI
 */
function setDemoStatus(status, message) {
    demo.status = status;
    document.querySelector('#connectionStatus .status-text').textContent = 'Simulation mode';
    demoText('demo-status', message);
    demoElement('demo-start').disabled = status === 'running';
    demoElement('demo-start').textContent = status === 'paused' ? 'Resume' : status === 'complete' ? 'Replay' : 'Start';
    demoElement('demo-pause').disabled = status !== 'running';
}

/**
 * Reset demo state and UI
 */
export function resetDemo() {
    demo.run++; // Invalidates callbacks and in-flight explanations from the previous run
    demo.request?.abort();
    demo.request = null;
    demo.controller?.pause();
    demo.controller?.reset?.();
    demo.controller = null;
    demo.reading = null;
    demo.event = null;
    demo.example = false;
    demo.readings = [];
    demo.events = [];
    
    // Reset UI elements
    demoElement('trip-summary').hidden = true;
    for (const id of ['trip-summary-title', 'trip-summary-details', 'trip-summary-next']) {
        demoText(id, '');
    }
    demoText('chart-findings', 'No findings marked yet.');
    for (const id of ['rpm-value', 'speed-value', 'coolant-value', 'load-value', 'intake-air-value', 'battery-value', 'fuel-trim-short-value', 'maf-value']) {
        demoText(id, '—');
    }
    
    // Reset chart
    if (demo.chart) {
        demo.chart.data.datasets.splice(3);
        demo.chart.data.datasets.forEach(dataset => { dataset.data = []; });
        demo.chart.update('none');
        demoText('chart-status', 'Waiting for readings.');
    }
    
    // Reset recommendation card
    demoElement('recommendation-card').removeAttribute('data-urgency');
    demoText('recommendation-urgency', 'Waiting for data');
    demoText('explanation-source', 'No explanation yet');
    demoText('recommendation-title', findingStatus(null));
    demoText('recommendation-observation', 'No readings yet.');
    demoText('recommendation-why', 'A series of readings helps show how temperature changes over time.');
    demoText('likely-causes', '—');
    demoText('why-it-matters', '—');
    demoText('what-to-do', '—');
    demoText('recommendation-next', 'Choose a scenario, then press Start.');
    demoText('recommendation-evidence', 'Evidence will appear here as readings arrive.');
    demoText('finding-rule', 'Waiting for analysis.');
    demoText('finding-duration', 'Waiting for analysis.');
    
    setDemoStatus('ready', 'Ready. Choose a scenario and press Start.');
}

/**
 * Start demo simulation
 */
export function startDemo() {
    if (demo.status === 'running') return;
    if (demo.status === 'complete') resetDemo();
    
    if (!demo.controller) {
        const run = demo.run;
        const current = callback => (...args) => { if (run === demo.run) return callback(...args); };
        
        try {
            demo.controller = demo.adapters.createSimulation({
                scenario_id: demoElement('demo-scenario').value,
                run_id: `${demoSessionId}-run-${run}`,
                onReading: current(renderReading),
                onAnalysis: current(renderAnalysis),
                onComplete: current(completeDemo)
            });
        } catch (error) {
            setDemoStatus('ready', `Could not start the data source: ${error.message}`);
            return;
        }
    }
    
    setDemoStatus('running', 'Running · Simulated vehicle data');
    demo.controller.start();
}

/**
 * Pause demo simulation
 */
export function pauseDemo() {
    demo.controller?.pause();
    setDemoStatus('paused', 'Paused. Readings and elapsed time stay here until you resume.');
}

/**
 * Mark a finding on the chart
 */
function markFinding(record) {
    if (!record.location) return;
    
    const { event, location } = record;
    const normal = event.urgency === 'normal';
    const label = findingStatus(event);
    
    if (demo.chart) {
        demo.chart.data.datasets[normal ? 1 : 2].data.push({ 
            x: location.x, 
            y: location.y,
            finding_label: label, 
            event_id: event.event_id 
        });
        demo.chart.data.datasets.push({ 
            label: `${label}: supporting window`, 
            data: location.points,
            borderColor: normal ? 'rgba(46,125,50,0.25)' : 'rgba(166,95,0,0.3)',
            borderWidth: 10, 
            pointRadius: 0, 
            tension: 0, 
            order: 1 
        });
        demo.chart.update('none');
    }
    
    demoText('chart-findings', demo.events.filter(record => record.location).map(({ event, location }) =>
        `${findingStatus(event)} at ${numberText(location.x)} s (${numberText(location.y)} °C); supporting window ${numberText(location.start_s)}–${numberText(location.x)} s.`
    ).join(' '));
}

/**
 * Complete demo run and show summary
 */
function completeDemo() {
    setDemoStatus('complete', 'Run complete. Review the trip summary, replay, or choose another scenario.');
    const summary = summarizeTrip(demo.events);
    demoText('trip-summary-title', summary.title);
    demoText('trip-summary-details', summary.details);
    demoText('trip-summary-next', summary.next_step);
    demoElement('trip-summary').hidden = false;
}

/**
 * Render reading update
 * @param {Object} reading - OBD-II reading data
 * @returns {boolean} - True if render succeeded
 */
export function renderReading(reading) {
    if (reading.scenario_id !== demoElement('demo-scenario').value || 
        reading.source !== 'simulation' ||
        !Number.isFinite(reading.elapsed_s) || 
        !Number.isFinite(reading.timestamp_ms)) {
        return false;
    }
    
    demo.reading = reading;
    demo.readings.push({ ...reading });
    
    // Update metric displays
    for (const [id, metric] of [
        ['rpm-value', 'rpm'], 
        ['speed-value', 'speed_kmh'], 
        ['coolant-value', 'coolant_c'], 
        ['load-value', 'engine_load_pct'],
        ['intake-air-value', 'intake_air_temp_c'],
        ['battery-value', 'battery_voltage'],
        ['fuel-trim-short-value', 'fuel_trim_short_pct'],
        ['maf-value', 'maf_gps']
    ]) {
        demoText(id, numberText(reading[metric]));
    }
    
    // Update chart
    if (demo.chart) {
        demo.chart.data.datasets[0].data.push({ 
            x: reading.elapsed_s, 
            y: Number.isFinite(reading.coolant_c) ? reading.coolant_c : null 
        });
        demo.chart.update('none');
        demoText('chart-status', `Latest: ${numberText(reading.coolant_c)} °C at ${numberText(reading.elapsed_s)} s. Missing readings appear as gaps.`);
    }
    
    // Show waiting message if no analysis yet
    if (!demo.event) {
        demoText('recommendation-title', 'Collecting readings');
        demoText('recommendation-observation', 'The readings are arriving. Waiting for an analysis of the pattern.');
        demoText('recommendation-next', 'Watch the temperature chart as the run continues.');
        demoText('recommendation-urgency', 'Waiting for analysis');
    }
    
    return true;
}

/**
 * Render analysis update
 * @param {Object} event - Analysis event
 * @param {Object} explanation - AI explanation (optional)
 * @param {Object} options - Render options
 * @returns {boolean} - True if render succeeded
 */
export function renderAnalysis(event, explanation = null, { example = false } = {}) {
    if (!event || 
        typeof event.event_id !== 'string' || 
        event.scenario_id !== demoElement('demo-scenario').value ||
        !Array.isArray(event.evidence) || 
        !Array.isArray(event.limitations) ||
        !['normal', 'attention', 'urgent', 'unknown'].includes(event.urgency) ||
        typeof event.approved_next_step !== 'string') {
        return false;
    }
    
    // If this is the same event, just update explanation
    if (demo.event?.event_id === event.event_id) {
        return explanation ? renderExplanation(explanation) : true;
    }
    
    demo.request?.abort();
    
    // Freeze event evidence locally to prevent mutations
    event = { 
        ...event, 
        evidence: event.evidence.map(item => ({ ...item })), 
        limitations: [...event.limitations] 
    };
    demo.event = event;
    
    // Find reading that matches this event
    const anchor = demo.readings.find(reading => 
        reading.scenario_id === event.scenario_id && 
        reading.timestamp_ms === event.observed_at_ms
    );
    
    const record = { 
        event, 
        elapsed_s: anchor?.elapsed_s ?? null,
        location: ['normal', 'attention', 'urgent'].includes(event.urgency) ? 
            locateFinding(event, demo.readings) : null 
    };
    
    demo.events.push(record);
    markFinding(record);
    demo.example = example;
    
    // Update recommendation card
    demoText('recommendation-title', findingStatus(event));
    demoElement('recommendation-card').dataset.urgency = event.urgency;
    demoText('recommendation-urgency', { 
        normal: 'Normal pattern', 
        attention: 'Needs attention', 
        urgent: 'Urgent', 
        unknown: 'Not enough information' 
    }[event.urgency]);
    
    demoText('finding-rule', describeRule(event));
    demoText('recommendation-evidence', evidenceText(event, false) || 'No numeric evidence supplied.');
    demoText('finding-duration', event.evidence.map(item =>
        `${metricLabel(item.metric)}: ${numberText(item.duration_s)} s`
    ).join(' · ') || 'Observation duration not supplied.');
    
    demoText('recommendation-observation', record.elapsed_s === null
        ? 'This finding could not be matched to a reading in this run.'
        : `Finding at ${numberText(record.elapsed_s)} s. Evidence below stays fixed; gauges show the latest readings.`
    );
    
    // Show template explanation as fallback
    const templateExplanations = {
        'normal_warmup': {
            title: 'Normal engine warm-up pattern',
            explanation: 'SUMMARY: The engine coolant temperature is rising steadily from a cold start, which is normal behavior. ' +
                'LIKELY_CAUSES: The engine is warming up naturally as the coolant circulates and absorbs heat from combustion. ' +
                'WHY_IT_MATTERS: Proper warm-up ensures the engine reaches optimal operating temperature for efficiency and emissions control. ' +
                'WHAT_TO_DO: Continue driving normally. The engine will reach its target temperature soon.',
        },
        'temperature_rise': {
            title: 'Temperature rising above normal',
            explanation: 'SUMMARY: The coolant temperature is climbing above the normal operating range, which requires attention. ' +
                'LIKELY_CAUSES: Possible low coolant level, thermostat malfunction, cooling fan issue, or radiator blockage. ' +
                'WHY_IT_MATTERS: Overheating can cause serious engine damage including warped cylinder heads or blown head gasket. ' +
                'WHAT_TO_DO: Pull over safely when possible. Check coolant level when cool. If it continues rising, seek professional help.',
        },
        'insufficient_data': {
            title: 'Collecting baseline readings',
            explanation: 'SUMMARY: Gathering initial readings to establish baseline patterns for analysis. ' +
                'LIKELY_CAUSES: Demo just started - need more data points to identify trends. ' +
                'WHY_IT_MATTERS: Accurate analysis requires multiple readings over time to distinguish normal from abnormal patterns. ' +
                'WHAT_TO_DO: Wait for more readings. Patterns typically become clear after 10-15 seconds.',
        }
    };
    
    const template = templateExplanations[event.condition] || {
        title: 'Pattern detected',
        explanation: 'SUMMARY: A vehicle data pattern has been detected. ' +
            'LIKELY_CAUSES: The specific cause depends on multiple factors shown in the evidence. ' +
            'WHY_IT_MATTERS: Understanding data patterns helps maintain vehicle health. ' +
            'WHAT_TO_DO: Review the evidence and follow the approved guidance below.',
    };
    
    renderExplanation({ 
        event_id: event.event_id,
        title: template.title,
        explanation: template.explanation,
        next_step: event.approved_next_step, 
        limitation: event.limitations.join(' ') || 'These readings alone cannot establish the vehicle\'s condition. Professional diagnosis recommended.', 
        explanation_source: 'template' 
    });
    
    // Request AI explanation if provided
    if (explanation && renderExplanation(explanation)) return true;
    if (!example) void requestExplanation(event);
    
    return true;
}

/**
 * Render AI explanation
 * @param {Object} explanation - Explanation object
 * @returns {boolean} - True if render succeeded
 */
export function renderExplanation(explanation) {
    if (!demo.event || 
        explanation?.event_id !== demo.event.event_id ||
        !['ai', 'template'].includes(explanation.explanation_source) ||
        !['title', 'explanation', 'next_step', 'limitation'].every(key => 
            typeof explanation[key] === 'string' && explanation[key].trim()
        )) {
        return false;
    }
    
    // Parse and display the AI explanation in structured sections
    const explanation_text = explanation.explanation || '';
    
    // Parse sections from the AI response
    const sections = {
        summary: '',
        likely_causes: '',
        why_it_matters: '',
        what_to_do: ''
    };
    
    // Extract SUMMARY
    const summaryMatch = explanation_text.match(/SUMMARY:\s*(.+?)(?=LIKELY_CAUSES:|WHY_IT_MATTERS:|WHAT_TO_DO:|$)/s);
    if (summaryMatch) sections.summary = summaryMatch[1].trim();
    
    // Extract LIKELY_CAUSES
    const causesMatch = explanation_text.match(/LIKELY_CAUSES:\s*(.+?)(?=WHY_IT_MATTERS:|WHAT_TO_DO:|$)/s);
    if (causesMatch) sections.likely_causes = causesMatch[1].trim();
    
    // Extract WHY_IT_MATTERS
    const whyMatch = explanation_text.match(/WHY_IT_MATTERS:\s*(.+?)(?=WHAT_TO_DO:|$)/s);
    if (whyMatch) sections.why_it_matters = whyMatch[1].trim();
    
    // Extract WHAT_TO_DO
    const whatMatch = explanation_text.match(/WHAT_TO_DO:\s*(.+?)$/s);
    if (whatMatch) sections.what_to_do = whatMatch[1].trim();
    
    // Fill in the sections
    demoText('recommendation-why', sections.summary || 'Analyzing vehicle data...');
    demoText('likely-causes', sections.likely_causes || '—');
    demoText('why-it-matters', sections.why_it_matters || '—');
    demoText('what-to-do', sections.what_to_do || '—');
    
    // Update approved guidance
    demoText('recommendation-next', demo.event.approved_next_step);
    
    const limitations = [...demo.event.limitations];
    if (!limitations.join(' ').includes(explanation.limitation)) {
        limitations.push(explanation.limitation);
    }
    
    demoText('explanation-source', 
        demo.example ? 'Example explanation · Temporary preview' : 
        explanation.explanation_source === 'ai' ? 'AI explanation · Powered by OpenAI' : 
        'Template explanation · AI service unavailable (works offline)'
    );
    
    return true;
}

/**
 * Request AI explanation from server
 * @param {Object} event - Event to explain
 */
async function requestExplanation(event) {
    const run = demo.run;
    const request = new AbortController();
    demo.request = request;
    const timeout = setTimeout(() => request.abort(), 6000);
    
    try {
        const explanation = demo.adapters.explain
            ? await demo.adapters.explain(event, { signal: request.signal })
            : await fetch('/api/explain', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event), 
                signal: request.signal 
            }).then(response => {
                if (!response.ok) throw new Error('Explanation unavailable');
                return response.json();
            });
        
        if (!request.signal.aborted && 
            run === demo.run && 
            event.event_id === demo.event?.event_id) {
            renderExplanation(explanation);
        }
    } catch {
        // The labeled template remains visible when the endpoint is unavailable
    } finally {
        clearTimeout(timeout);
        if (demo.request === request) demo.request = null;
    }
}

/**
 * Configure demo adapters
 * @param {Object} options - Configuration options
 */
export function configureDemo({ createSimulation, explain } = {}) {
    resetDemo();
    if (createSimulation) demo.adapters.createSimulation = createSimulation;
    if (explain !== undefined) demo.adapters.explain = explain;
    
    demoText('demo-mode', 
        demo.adapters.createSimulation === createExamplePreview
            ? 'Example preview · Six fixed readings, played one per second. No vehicle connection needed.'
            : 'Time-compressed simulation · 45-second scenarios. No vehicle connection needed.'
    );
}

// Export public API
export const DemoController = {
    initialize: initializeDemo,
    start: startDemo,
    pause: pauseDemo,
    reset: resetDemo,
    renderReading,
    renderAnalysis,
    renderExplanation,
    configure: configureDemo
};
