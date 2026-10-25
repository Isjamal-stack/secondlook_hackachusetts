/**
 * Data Worker - Web Worker for real-time data polling
 * Offloads OBD-II data collection and processing from the main thread
 * 
 * Responsibilities:
 * - Poll multiple PIDs in the background
 * - Parse and decode PID responses
 * - Calculate derived metrics
 * - Batch data for storage
 * - Send updates to main thread for UI
 */

// Worker-specific logger (can't import modules in regular workers)
const workerLogger = {
    debug: (...args) => {
        if (self.DEV_MODE !== false) {
            console.log('[DataWorker] [DEBUG]', ...args);
        }
    },
    info: (...args) => console.log('[DataWorker] [INFO]', ...args),
    warn: (...args) => console.warn('[DataWorker] [WARN]', ...args),
    error: (...args) => console.error('[DataWorker] [ERROR]', ...args)
};

workerLogger.info('Worker thread started');

// Worker state
const state = {
    polling: false,
    interval: 1000,
    pollingTimer: null,
    pidQueue: [],
    currentPidIndex: 0,
    dataBuffer: [],
    bufferSize: 10, // Store 10 readings before sending to storage
    sessionStartTime: null,
    readingCount: 0,
    lastPollingTime: 0
};

// PIDs to poll (in order of priority)
const PIDS_TO_POLL = [
    { pid: '01 0C', name: 'rpm', unit: 'rpm' },           // Engine RPM
    { pid: '01 0D', name: 'speed', unit: 'km/h' },        // Vehicle Speed
    { pid: '01 05', name: 'coolant_temp', unit: '°C' },   // Coolant Temperature
    { pid: '01 04', name: 'engine_load', unit: '%' },     // Engine Load
    { pid: '01 2F', name: 'fuel_level', unit: '%' },      // Fuel Level
    { pid: '01 11', name: 'throttle_pos', unit: '%' }     // Throttle Position
];

/**
 * Message handler - receives commands from main thread
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    workerLogger.debug('Received message:', type);
    
    switch (type) {
        case 'START_POLLING':
            startPolling(data?.interval || 1000);
            break;
            
        case 'STOP_POLLING':
            stopPolling();
            break;
            
        case 'PID_RESPONSE':
            handlePidResponse(data);
            break;
            
        case 'INIT':
            initialize(data);
            break;
            
        case 'UPDATE_INTERVAL':
            updateInterval(data?.interval);
            break;
            
        case 'FLUSH_BUFFER':
            flushBuffer();
            break;
            
        default:
            workerLogger.warn('Unknown message type:', type);
    }
});

/**
 * Initialize worker
 */
function initialize(config) {
    workerLogger.info('Initialized with config:', config);
    
    if (config?.interval) {
        state.interval = config.interval;
    }
    
    if (config?.bufferSize) {
        state.bufferSize = config.bufferSize;
    }
    
    state.sessionStartTime = Date.now();
    state.pidQueue = [...PIDS_TO_POLL];
    
    self.postMessage({ type: 'INITIALIZED', data: { pidCount: PIDS_TO_POLL.length } });
}

/**
 * Start polling loop
 */
function startPolling(interval) {
    if (state.polling) {
        workerLogger.warn('Already polling');
        return;
    }
    
    workerLogger.info('Starting polling at', interval, 'ms interval');
    state.polling = true;
    state.interval = interval || state.interval;
    state.sessionStartTime = Date.now();
    state.currentPidIndex = 0;
    state.readingCount = 0;
    
    // Start polling cycle
    pollNextPid();
    
    self.postMessage({ type: 'POLLING_STARTED' });
}

/**
 * Stop polling loop
 */
function stopPolling() {
    if (!state.polling) {
        return;
    }
    
    workerLogger.info('Stopping polling');
    state.polling = false;
    
    if (state.pollingTimer) {
        clearTimeout(state.pollingTimer);
        state.pollingTimer = null;
    }
    
    // Flush remaining data
    if (state.dataBuffer.length > 0) {
        flushBuffer();
    }
    
    self.postMessage({ type: 'POLLING_STOPPED', data: { readingCount: state.readingCount } });
}

/**
 * Update polling interval
 */
function updateInterval(interval) {
    if (interval && interval > 0) {
        state.interval = interval;
        workerLogger.info('Polling interval updated to', interval, 'ms');
    }
}

/**
 * Poll the next PID in the queue
 */
function pollNextPid() {
    if (!state.polling) {
        return;
    }
    
    const pid = state.pidQueue[state.currentPidIndex];
    
    if (!pid) {
        workerLogger.error('No PID to poll');
        return;
    }
    
    // Request PID from main thread (which has access to BluetoothManager)
    self.postMessage({
        type: 'REQUEST_PID',
        data: {
            pid: pid.pid,
            name: pid.name
        }
    });
    
    // Move to next PID
    state.currentPidIndex = (state.currentPidIndex + 1) % state.pidQueue.length;
    
    // Schedule next poll based on interval divided by number of PIDs
    const pollDelay = Math.max(100, state.interval / state.pidQueue.length);
    state.pollingTimer = setTimeout(() => pollNextPid(), pollDelay);
}

/**
 * Handle PID response from main thread
 */
function handlePidResponse(responseData) {
    const { pid, name, value, raw, timestamp } = responseData;
    
    if (value === null || value === undefined) {
        workerLogger.warn('Invalid response for', name, ':', value);
        return;
    }
    
    state.readingCount++;
    
    // Add to data buffer
    const reading = {
        timestamp: timestamp || Date.now(),
        [name]: value,
        raw: raw
    };
    
    // Merge with existing reading at same timestamp or add new
    const existingIndex = state.dataBuffer.findIndex(r => 
        Math.abs(r.timestamp - reading.timestamp) < 100
    );
    
    if (existingIndex >= 0) {
        // Merge into existing reading
        state.dataBuffer[existingIndex] = {
            ...state.dataBuffer[existingIndex],
            ...reading
        };
    } else {
        // Add new reading
        state.dataBuffer.push(reading);
    }
    
    // Check if we have a complete reading with all PIDs
    const latestReading = state.dataBuffer[state.dataBuffer.length - 1];
    const isComplete = PIDS_TO_POLL.every(p => latestReading[p.name] !== undefined);
    
    if (isComplete) {
        // Send update to UI
        self.postMessage({
            type: 'DATA_UPDATE',
            data: {
                ...latestReading,
                complete: true
            }
        });
        
        // Calculate derived metrics
        const metrics = calculateMetrics(latestReading);
        if (metrics) {
            self.postMessage({
                type: 'METRICS_UPDATE',
                data: metrics
            });
        }
    }
    
    // Flush buffer if full
    if (state.dataBuffer.length >= state.bufferSize) {
        flushBuffer();
    }
}

/**
 * Calculate derived metrics from readings
 */
function calculateMetrics(reading) {
    if (!reading.speed || !reading.rpm) {
        return null;
    }
    
    const metrics = {};
    
    // Instantaneous fuel consumption estimate (L/100km)
    // Rough formula: (RPM * Load * displacement) / (Speed * 14.7 * fuel_density)
    // Simplified for demonstration
    if (reading.speed > 0 && reading.engine_load) {
        const baseFuelRate = (reading.rpm * reading.engine_load) / 10000;
        metrics.instant_fuel_consumption = (baseFuelRate / reading.speed) * 100;
    }
    
    // Gear estimate (rough calculation based on RPM/Speed ratio)
    if (reading.speed > 0) {
        const ratio = reading.rpm / reading.speed;
        if (ratio > 100) metrics.estimated_gear = 1;
        else if (ratio > 60) metrics.estimated_gear = 2;
        else if (ratio > 40) metrics.estimated_gear = 3;
        else if (ratio > 30) metrics.estimated_gear = 4;
        else metrics.estimated_gear = 5;
    }
    
    // Engine efficiency score (0-100)
    // Higher load at lower RPM is more efficient
    if (reading.rpm && reading.engine_load) {
        const idealRPM = 2000;
        const rpmEfficiency = Math.max(0, 100 - Math.abs(reading.rpm - idealRPM) / 50);
        const loadEfficiency = reading.engine_load;
        metrics.efficiency_score = (rpmEfficiency * 0.6 + loadEfficiency * 0.4);
    }
    
    // Driving aggressiveness (0-100)
    // Based on throttle position and rate of change
    if (reading.throttle_pos && reading.rpm) {
        const throttleScore = reading.throttle_pos;
        const rpmScore = Math.min(100, (reading.rpm / 6000) * 100);
        metrics.aggressiveness = (throttleScore * 0.7 + rpmScore * 0.3);
    }
    
    return metrics;
}

/**
 * Flush data buffer to storage
 */
function flushBuffer() {
    if (state.dataBuffer.length === 0) {
        return;
    }
    
    workerLogger.debug('Flushing', state.dataBuffer.length, 'readings to storage');
    
    // Send batch to main thread for storage
    self.postMessage({
        type: 'STORE_BATCH',
        data: {
            readings: [...state.dataBuffer],
            count: state.dataBuffer.length
        }
    });
    
    // Clear buffer
    state.dataBuffer = [];
}

/**
 * Error handler
 */
self.addEventListener('error', (event) => {
    workerLogger.error('Worker error:', event.message);
    self.postMessage({
        type: 'ERROR',
        data: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno
        }
    });
});

workerLogger.info('Ready to receive messages');
