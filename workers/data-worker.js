/**
 * Data Worker - Web Worker for data processing
 * Offloads heavy computations from the main thread
 * 
 * This worker will be fully implemented in Task 6
 */

console.log('[DataWorker] Worker thread started');

// Worker state
const state = {
    polling: false,
    interval: 1000,
    pollingTimer: null
};

/**
 * Message handler - receives commands from main thread
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    console.log('[DataWorker] Received message:', type);
    
    switch (type) {
        case 'START_POLLING':
            startPolling(data?.interval || 1000);
            break;
            
        case 'STOP_POLLING':
            stopPolling();
            break;
            
        case 'PARSE_RESPONSE':
            parseResponse(data);
            break;
            
        case 'INIT':
            initialize(data);
            break;
            
        default:
            console.warn('[DataWorker] Unknown message type:', type);
    }
});

/**
 * Initialize worker
 */
function initialize(config) {
    console.log('[DataWorker] Initialized with config:', config);
    self.postMessage({ type: 'INITIALIZED' });
}

/**
 * Start polling loop
 */
function startPolling(interval) {
    if (state.polling) {
        console.warn('[DataWorker] Already polling');
        return;
    }
    
    console.log('[DataWorker] Starting polling at', interval, 'ms interval');
    state.polling = true;
    state.interval = interval;
    
    // TODO: Implement in Task 6
    // This will poll PIDs and send parsed data to main thread
    
    self.postMessage({ type: 'POLLING_STARTED' });
}

/**
 * Stop polling loop
 */
function stopPolling() {
    if (!state.polling) {
        return;
    }
    
    console.log('[DataWorker] Stopping polling');
    state.polling = false;
    
    if (state.pollingTimer) {
        clearInterval(state.pollingTimer);
        state.pollingTimer = null;
    }
    
    self.postMessage({ type: 'POLLING_STOPPED' });
}

/**
 * Parse OBD-II response
 */
function parseResponse(data) {
    // TODO: Implement in Task 6
    console.log('[DataWorker] Parsing response:', data);
    
    self.postMessage({
        type: 'DATA_UPDATE',
        data: {
            rpm: 0,
            speed: 0,
            coolant_temp: 0,
            engine_load: 0,
            fuel_level: 0,
            throttle_pos: 0
        }
    });
}

console.log('[DataWorker] Ready to receive messages');
