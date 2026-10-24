/**
 * Main Application Entry Point
 * Handles app initialization, routing, and UI interactions
 */

import { createExamplePreview } from './demo-examples.js';
import { createSimulation } from './simulation.js';
import { GLOSSARY, findingStatus, describeRule, locateFinding, summarizeTrip } from './demo-presentation.js';

import { StorageManager } from './storage-manager.js';
import { SampleDataGenerator } from './sample-data.js';
import { ChartManager } from './chart-manager.js';
import { BluetoothManager } from './bluetooth-manager.js';
import { ELM327Protocol } from './elm327-protocol.js';

// Application state
const app = {
    currentView: 'dashboard',
    worker: null,
    connected: false,
    protocolReady: false,
    storage: null,
    sampleDataGenerator: null,
    chartManager: null,
    bluetoothManager: null,
    elm327Protocol: null
};

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', async () => {
    initializeDemo(); // Independent of Bluetooth, IndexedDB, and the legacy worker.
    configureDemo({ createSimulation });
    console.log('[App] Initializing...');
    
    try {
        // Initialize storage
        app.storage = new StorageManager();
        await app.storage.init();
        console.log('[App] Storage initialized successfully');
        
        // Initialize sample data generator
        app.sampleDataGenerator = new SampleDataGenerator();
        console.log('[App] Sample data generator ready');
        
        // Initialize chart manager
        app.chartManager = new ChartManager(app.storage);
        console.log('[App] Chart manager ready');
        
        // Initialize Bluetooth manager
        app.bluetoothManager = new BluetoothManager();
        console.log('[App] Bluetooth manager ready');
        
        // Initialize ELM327 protocol
        app.elm327Protocol = new ELM327Protocol();
        console.log('[App] ELM327 protocol ready');
        
        // Initialize data worker
        initializeDataWorker();
        
        // Register service worker
        // Demo uses fresh assets; leave the existing worker file under shared ownership.
        // Do not register the cache-first worker during the hackathon preview.
        
        // Setup install prompt
        setupInstallPrompt();
        
        // Setup navigation
        setupNavigation();
        
        // Setup UI interactions
        setupEventListeners();
        
        // Check browser support
        checkBrowserSupport();
        
        // Update storage usage display
        await updateStorageUsage();
        
        // Load initial view
        switchView('dashboard');
        
        console.log('[App] Initialization complete');
    } catch (error) {
        console.error('[App] Initialization failed:', error);
        showToast('Failed to initialize app: ' + error.message, 'error');
    }
});

/**
 * Initialize data worker for background data polling
 */
function initializeDataWorker() {
    if (typeof Worker === 'undefined') {
        console.warn('[App] Web Workers not supported');
        return;
    }
    
    try {
        app.worker = new Worker('/workers/data-worker.js');
        
        // Handle messages from worker
        app.worker.addEventListener('message', (event) => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'INITIALIZED':
                    console.log('[App] Worker initialized, will poll', data.pidCount, 'PIDs');
                    break;
                    
                case 'POLLING_STARTED':
                    console.log('[App] Worker started polling');
                    showToast('Live data collection started');
                    break;
                    
                case 'POLLING_STOPPED':
                    console.log('[App] Worker stopped polling, collected', data.readingCount, 'readings');
                    showToast(`Data collection stopped (${data.readingCount} readings)`);
                    break;
                    
                case 'REQUEST_PID':
                    // Worker requests a PID - send it via Bluetooth
                    handleWorkerPIDRequest(data);
                    break;
                    
                case 'DATA_UPDATE':
                    // Worker sends parsed data for UI update
                    updateDashboardMetrics(data);
                    break;
                    
                case 'METRICS_UPDATE':
                    // Worker sends calculated metrics
                    updateDashboardAdvancedMetrics(data);
                    break;
                    
                case 'STORE_BATCH':
                    // Worker sends batch of readings for storage
                    storeReadingBatch(data.readings);
                    break;
                    
                case 'ERROR':
                    console.error('[App] Worker error:', data.message);
                    showToast('Worker error: ' + data.message, 'error');
                    break;
                    
                default:
                    console.warn('[App] Unknown worker message:', type);
            }
        });
        
        // Handle worker errors
        app.worker.addEventListener('error', (event) => {
            console.error('[App] Worker error:', event.message);
            showToast('Worker error', 'error');
        });
        
        // Initialize worker
        app.worker.postMessage({
            type: 'INIT',
            data: {
                interval: 1000, // 1 second polling interval
                bufferSize: 10  // Store every 10 readings
            }
        });
        
        console.log('[App] Data worker initialized');
    } catch (error) {
        console.error('[App] Failed to initialize worker:', error);
    }
}

/**
 * Handle PID request from worker
 */
async function handleWorkerPIDRequest(data) {
    const { pid, name } = data;
    
    // Check if connected
    if (!app.bluetoothManager || !app.bluetoothManager.isConnected()) {
        console.warn('[App] Not connected, cannot fulfill PID request');
        return;
    }
    
    try {
        // Send PID request via Bluetooth
        const response = await app.bluetoothManager.sendCommand(pid);
        
        // Parse response using ELM327 protocol
        const pidCode = pid.split(' ')[1]; // Extract PID code (e.g., "0C" from "01 0C")
        const value = app.elm327Protocol.parsePIDResponse(response, pidCode);
        
        // Send parsed value back to worker
        app.worker.postMessage({
            type: 'PID_RESPONSE',
            data: {
                pid: pid,
                name: name,
                value: value,
                raw: response,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('[App] PID request failed:', error);
        
        // Send error to worker
        app.worker.postMessage({
            type: 'PID_RESPONSE',
            data: {
                pid: pid,
                name: name,
                value: null,
                error: error.message,
                timestamp: Date.now()
            }
        });
    }
}

/**
 * Update advanced dashboard metrics
 */
function updateDashboardAdvancedMetrics(data) {
    // Update efficiency score if element exists
    const efficiencyEl = document.getElementById('efficiency-score');
    if (efficiencyEl && data.efficiency_score !== undefined) {
        efficiencyEl.textContent = Math.round(data.efficiency_score);
    }
    
    // Update gear estimate if element exists
    const gearEl = document.getElementById('estimated-gear');
    if (gearEl && data.estimated_gear !== undefined) {
        gearEl.textContent = data.estimated_gear;
    }
    
    // Update fuel consumption if element exists
    const fuelConsumptionEl = document.getElementById('fuel-consumption');
    if (fuelConsumptionEl && data.instant_fuel_consumption !== undefined) {
        fuelConsumptionEl.textContent = data.instant_fuel_consumption.toFixed(1);
    }
    
    // Update aggressiveness if element exists
    const aggressivenessEl = document.getElementById('aggressiveness');
    if (aggressivenessEl && data.aggressiveness !== undefined) {
        aggressivenessEl.textContent = Math.round(data.aggressiveness);
    }
}

/**
 * Store batch of readings from worker
 */
async function storeReadingBatch(readings) {
    try {
        await app.storage.storeReadings(readings);
        console.log('[App] Stored batch of', readings.length, 'readings');
    } catch (error) {
        console.error('[App] Failed to store reading batch:', error);
    }
}

/**
 * Start live data collection
 */
function startDataCollection() {
    if (!app.worker) {
        showToast('Worker not initialized', 'error');
        return;
    }
    
    if (!app.bluetoothManager || !app.bluetoothManager.isConnected()) {
        showToast('Not connected to vehicle', 'error');
        return;
    }
    
    app.worker.postMessage({ type: 'START_POLLING', data: { interval: 1000 } });
}

/**
 * Stop live data collection
 */
function stopDataCollection() {
    if (!app.worker) {
        return;
    }
    
    app.worker.postMessage({ type: 'STOP_POLLING' });
}

/**
 * Register service worker for PWA functionality
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('[App] Service Worker registered:', registration);
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('New version available! Refresh to update.');
                    }
                });
            });
        } catch (error) {
            console.error('[App] Service Worker registration failed:', error);
        }
    }
}

/**
 * Setup PWA install prompt
 */
function setupInstallPrompt() {
    let deferredPrompt;
    const installButton = document.getElementById('installButton');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'block';
    });
    
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log('[App] Install prompt outcome:', outcome);
        
        if (outcome === 'accepted') {
            showToast('App installed successfully!');
        }
        
        deferredPrompt = null;
        installButton.style.display = 'none';
    });
    
    // Hide button if already installed
    window.addEventListener('appinstalled', () => {
        installButton.style.display = 'none';
        showToast('App installed successfully!');
    });
}

/**
 * Setup navigation between views
 */
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const view = button.getAttribute('data-view');
            switchView(view);
            
            // Update active state
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

/**
 * Switch to a different view
 */
function switchView(viewName) {
    // The presentation exposes only the verified dashboard. Legacy views stay in source.
    if (viewName !== 'dashboard') return;
    console.log('[App] Switching to view:', viewName);
    
    // Hide all views
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active'));
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
        app.currentView = viewName;
        
        // Load data for specific views
        if (viewName === 'settings' && app.storage) {
            loadVehicleProfile();
        } else if (viewName === 'history' && app.chartManager) {
            loadHistoryView();
        }
    }
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
    // Bluetooth connect button
    const bluetoothBtn = document.getElementById('bluetoothConnectBtn');
    if (bluetoothBtn) {
        bluetoothBtn.addEventListener('click', handleBluetoothConnect);
    }
    
    // File upload button
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (fileUploadBtn && fileInput) {
        fileUploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Terminal send button
    const terminalSend = document.getElementById('terminalSend');
    const terminalInput = document.getElementById('terminalInput');
    if (terminalSend && terminalInput) {
        terminalSend.addEventListener('click', handleTerminalSend);
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleTerminalSend();
        });
    }
    
    // Settings buttons
    const loadSampleBtn = document.getElementById('loadSampleDataBtn');
    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', handleLoadSampleData);
    }
    
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', handleExportData);
    }
    
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', handleClearData);
    }
    
    // History view controls
    const dateRangeSelect = document.getElementById('dateRange');
    if (dateRangeSelect) {
        dateRangeSelect.addEventListener('change', handleDateRangeChange);
    }
    
    const metricSelect = document.getElementById('metricSelect');
    if (metricSelect) {
        metricSelect.addEventListener('change', handleMetricChange);
    }
}

/**
 * Check browser support for required features
 */
function checkBrowserSupport() {
    const bluetoothSupport = document.getElementById('bluetoothSupport');
    
    if (bluetoothSupport) {
        if (navigator.bluetooth) {
            bluetoothSupport.textContent = '✓ Web Bluetooth supported';
            bluetoothSupport.classList.add('feature-support', 'supported');
        } else {
            bluetoothSupport.textContent = '✗ Web Bluetooth not supported. Please use Chrome/Edge or upload data files.';
            bluetoothSupport.classList.add('feature-support', 'unsupported');
            
            // Disable Bluetooth button
            const bluetoothBtn = document.getElementById('bluetoothConnectBtn');
            if (bluetoothBtn) {
                bluetoothBtn.disabled = true;
            }
        }
    }
}

/**
 * Handle Bluetooth connection
 */
async function handleBluetoothConnect() {
    console.log('[App] Bluetooth connect requested');
    
    if (!navigator.bluetooth) {
        showToast('Web Bluetooth is not supported in this browser', 'error');
        return;
    }
    
    try {
        showLoading('Connecting to device...');
        updateConnectionStatus('connecting');
        
        // For testing with emulator, use TCP simulation
        // In production, use real Bluetooth
        const useTCP = confirm('Connect to TCP emulator? (Cancel for real Bluetooth device)');
        
        if (useTCP) {
            await app.bluetoothManager.connectTCP();
        } else {
            await app.bluetoothManager.connect();
        }
        
        showToast('Device connected, initializing protocol...');
        updateConnectionStatus('searching');
        
        // Initialize ELM327 protocol
        await app.elm327Protocol.initialize((cmd) => app.bluetoothManager.sendCommand(cmd));
        
        updateConnectionStatus('ready');
        showToast('Connection ready! Protocol initialized.');
        hideLoading();
        
        // Show terminal for debugging
        const terminalSection = document.getElementById('terminalSection');
        if (terminalSection) {
            terminalSection.style.display = 'block';
        }
        
        // Start live data collection
        console.log('[App] Starting live data collection...');
        startDataCollection();
        
    } catch (error) {
        console.error('[App] Bluetooth connection failed:', error);
        showToast('Connection failed: ' + error.message, 'error');
        updateConnectionStatus('disconnected');
        hideLoading();
    }
}

/**
 * Handle file upload
 */
async function handleFileUpload(event) {
    event.target.value = '';
    showToast('Import is not available in this prototype. No data was saved.');
}

/**
 * Simple CSV parser
 */
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index]?.trim();
        });
        rows.push(row);
    }
    
    return rows;
}

/**
 * Handle terminal command send
 */
async function handleTerminalSend() {
    const input = document.getElementById('terminalInput');
    const output = document.getElementById('terminalOutput');
    
    const command = input.value.trim();
    if (!command) return;
    
    // Add to output
    appendTerminal(`> ${command}`);
    
    // Check if connected
    if (!app.bluetoothManager || !app.bluetoothManager.isConnected()) {
        appendTerminal('Error: Not connected to device');
        input.value = '';
        return;
    }
    
    try {
        // Send command
        const response = await app.bluetoothManager.sendCommand(command);
        appendTerminal(response);
        
        // If it's a PID request and protocol is ready, try to decode
        if (app.elm327Protocol.protocolReady && command.match(/^01[0-9A-F]{2}$/i)) {
            const pid = command.substring(2);
            const value = app.elm327Protocol.parsePIDResponse(response, pid);
            if (value !== null) {
                appendTerminal(`Decoded value: ${value}`);
            }
        }
    } catch (error) {
        appendTerminal(`Error: ${error.message}`);
    }
    
    input.value = '';
}

/**
 * Append text to terminal output
 */
function appendTerminal(text) {
    const output = document.getElementById('terminalOutput');
    if (output) {
        const line = document.createElement('div');
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
}

/**
 * Handle load sample data
 */
async function handleLoadSampleData() {
    console.log('[App] Loading sample data...');
    
    if (!confirm('This will generate 30 days of sample vehicle data. Continue?')) {
        return;
    }
    
    try {
        showLoading('Generating sample data...');
        
        // Generate sample data
        const sampleData = app.sampleDataGenerator.generateData(30);
        
        // Store vehicle profile
        await app.storage.storeVehicle(sampleData.vehicle);
        
        // Store readings in batches (for better performance)
        const batchSize = 1000;
        for (let i = 0; i < sampleData.readings.length; i += batchSize) {
            const batch = sampleData.readings.slice(i, i + batchSize);
            await app.storage.storeReadings(batch);
        }
        
        // Store trips
        for (const trip of sampleData.trips) {
            await app.storage.storeTrip(trip);
        }
        
        // Store maintenance records
        for (const record of sampleData.maintenance) {
            await app.storage.storeMaintenance(record);
        }
        
        // Store DTC history
        for (const dtc of sampleData.dtcHistory) {
            await app.storage.storeDTC(dtc);
        }
        
        // Update storage usage
        await updateStorageUsage();
        
        showToast(`Sample data loaded: ${sampleData.trips.length} trips, ${sampleData.readings.length} readings`);
        hideLoading();
        
        // Update vehicle profile in settings if on that view
        if (app.currentView === 'settings') {
            loadVehicleProfile();
        }
        
    } catch (error) {
        console.error('[App] Load sample data failed:', error);
        showToast('Failed to load sample data: ' + error.message, 'error');
        hideLoading();
    }
}

/**
 * Handle export data
 */
async function handleExportData() {
    console.log('[App] Exporting data...');
    
    try {
        showLoading('Exporting data...');
        
        // Export data from IndexedDB
        const data = await app.storage.exportData();
        
        // Create download
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vehicle-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast(`Data exported: ${data.readings.length} readings, ${data.trips.length} trips`);
        hideLoading();
        
    } catch (error) {
        console.error('[App] Export failed:', error);
        showToast('Export failed: ' + error.message, 'error');
        hideLoading();
    }
}

/**
 * Handle clear data
 */
async function handleClearData() {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        return;
    }
    
    console.log('[App] Clearing all data...');
    
    try {
        showLoading('Clearing data...');
        
        // Clear IndexedDB
        await app.storage.clearAll();
        
        // Update storage usage
        await updateStorageUsage();
        
        showToast('All data cleared');
        hideLoading();
        
        // Reset vehicle profile form if on settings view
        if (app.currentView === 'settings') {
            document.getElementById('vinInput').value = '';
            document.getElementById('makeInput').value = '';
            document.getElementById('modelInput').value = '';
            document.getElementById('yearInput').value = '';
        }
        
    } catch (error) {
        console.error('[App] Clear data failed:', error);
        showToast('Failed to clear data: ' + error.message, 'error');
        hideLoading();
    }
}

/**
 * Update storage usage display
 */
async function updateStorageUsage() {
    try {
        const estimate = await app.storage.getStorageEstimate();
        const storageUsedEl = document.getElementById('storageUsed');
        
        if (estimate && storageUsedEl) {
            const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
            const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
            storageUsedEl.textContent = `${usageMB} MB of ${quotaMB} MB (${estimate.percentage}%)`;
        } else if (storageUsedEl) {
            storageUsedEl.textContent = 'Unknown';
        }
    } catch (error) {
        console.error('[App] Failed to get storage estimate:', error);
    }
}

/**
 * Load vehicle profile into settings form
 */
async function loadVehicleProfile() {
    try {
        const vehicle = await app.storage.getVehicle();
        
        if (vehicle) {
            document.getElementById('vinInput').value = vehicle.vin || '';
            document.getElementById('makeInput').value = vehicle.make || '';
            document.getElementById('modelInput').value = vehicle.model || '';
            document.getElementById('yearInput').value = vehicle.year || '';
        }
    } catch (error) {
        console.error('[App] Failed to load vehicle profile:', error);
    }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    const statusText = statusEl.querySelector('.status-text');
    
    statusEl.className = 'connection-status';
    
    switch (status) {
        case 'connected':
            statusEl.classList.add('connected');
            statusText.textContent = 'Connected';
            app.connected = true;
            break;
        case 'connecting':
            statusEl.classList.add('connecting');
            statusText.textContent = 'Connecting...';
            break;
        case 'searching':
            statusEl.classList.add('connecting');
            statusText.textContent = 'Searching Protocol...';
            break;
        case 'ready':
            statusEl.classList.add('connected');
            statusText.textContent = 'Ready';
            app.connected = true;
            app.protocolReady = true;
            break;
        default:
            statusText.textContent = 'Disconnected';
            app.connected = false;
            app.protocolReady = false;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const messageEl = toast.querySelector('.toast-message');
    
    messageEl.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    
    text.textContent = message;
    overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'none';
}

/**
 * Update dashboard metrics (called from worker)
 */
function updateDashboardMetrics(data) {
    // Legacy readings use different units; never mix them into the demo dashboard.
    // Normalized readings enter through secondLookUI.renderReading().
    return;

}

// Export for use in other modules
window.app = app;
window.updateDashboardMetrics = updateDashboardMetrics;
window.updateDashboardAdvancedMetrics = updateDashboardAdvancedMetrics;
window.updateConnectionStatus = updateConnectionStatus;
window.showToast = showToast;
window.appendTerminal = appendTerminal;
window.startDataCollection = startDataCollection;
window.stopDataCollection = stopDataCollection;

console.log('[App] Module loaded');


/**
 * Load history view with chart
 */
async function loadHistoryView() {
    console.log('[App] Loading history view...');
    
    try {
        // Check if chart manager is ready
        if (!app.chartManager) {
            console.error('[App] Chart manager not initialized');
            showToast('Chart system not ready', 'error');
            return;
        }
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('[App] Chart.js library not loaded');
            showToast('Charting library not loaded. Check your internet connection.', 'error');
            return;
        }
        
        // Initialize chart ONLY if it doesn't exist
        if (!app.chartManager.charts.history) {
            console.log('[App] Initializing chart for first time');
            app.chartManager.initHistoryChart();
            
            // Verify chart was created
            if (!app.chartManager.charts.history) {
                console.error('[App] Failed to initialize chart');
                showToast('Failed to initialize chart', 'error');
                return;
            }
        } else {
            console.log('[App] Chart already exists, reusing it');
        }
        
        // Get current selections
        const dateRange = document.getElementById('dateRange').value;
        const metric = document.getElementById('metricSelect').value;
        
        // Update chart with data
        await updateHistoryChart(metric, dateRange);
        
    } catch (error) {
        console.error('[App] Failed to load history view:', error);
        showToast('Failed to load history data: ' + error.message, 'error');
    }
}

/**
 * Update history chart
 */
async function updateHistoryChart(metric, dateRange) {
    try {
        showLoading('Loading chart data...');
        
        // Update chart
        const stats = await app.chartManager.updateHistoryChart(metric, dateRange);
        
        // Update statistics display
        document.getElementById('avgStat').textContent = stats.avg;
        document.getElementById('minStat').textContent = stats.min;
        document.getElementById('maxStat').textContent = stats.max;
        
        hideLoading();
        
    } catch (error) {
        console.error('[App] Failed to update chart:', error);
        hideLoading();
        showToast('Failed to update chart', 'error');
    }
}

/**
 * Handle date range change
 */
async function handleDateRangeChange(event) {
    const dateRange = event.target.value;
    const metric = document.getElementById('metricSelect').value;
    await updateHistoryChart(metric, dateRange);
}

/**
 * Handle metric change
 */
async function handleMetricChange(event) {
    const metric = event.target.value;
    const dateRange = document.getElementById('dateRange').value;
    await updateHistoryChart(metric, dateRange);
}

// Person C integration surface. See DEMO_INTEGRATION.md for the adapter contract.
const demoSessionId = crypto.randomUUID();
const demo = {
    run: 0, status: 'ready', controller: null, chart: null, reading: null, event: null,
    example: false, request: null, readings: [], events: [],
    adapters: { createSimulation: createExamplePreview, explain: null }
};
const demoElement = id => document.getElementById(id);
const demoText = (id, value) => { demoElement(id).textContent = value; };
const numberText = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—';

function initializeDemo() {
    for (const [term, text] of Object.entries(GLOSSARY)) demoText(`glossary-${term}`, text);
    demoElement('demo-start').addEventListener('click', startDemo);
    demoElement('demo-pause').addEventListener('click', pauseDemo);
    demoElement('demo-reset').addEventListener('click', resetDemo);
    demoElement('demo-scenario').addEventListener('change', resetDemo);
    if (typeof Chart !== 'undefined') {
        demo.chart = new Chart(demoElement('coolant-trend'), {
            type: 'line',
            data: { datasets: [{ label: 'Coolant temperature (°C)', data: [], borderColor: '#1976d2',
                borderWidth: 2, pointRadius: 3, tension: 0, spanGaps: false, order: 0 },
                { type: 'scatter', label: 'Steady finding (circle)', data: [], pointStyle: 'circle', pointRadius: 7, pointHoverRadius: 9, backgroundColor: '#2e7d32', order: -1 },
                { type: 'scatter', label: 'Rising finding (triangle)', data: [], pointStyle: 'triangle', pointRadius: 8, pointHoverRadius: 10, backgroundColor: '#a65f00', order: -1 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: true, labels: { usePointStyle: true, filter: item => item.datasetIndex === 1 || item.datasetIndex === 2 } }, tooltip: { callbacks: {
                    label: item => `${item.raw.finding_label ? item.raw.finding_label + ': ' : ''}${numberText(item.parsed.y)} °C at ${numberText(item.parsed.x)} s`
                } } },
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Elapsed time (seconds)' }, ticks: { precision: 0 } },
                    y: { title: { display: true, text: 'Coolant temperature (°C)' } }
                }
            }
        });
    } else {
        demoText('chart-status', 'Chart library could not load. Connect to the internet and reload; readings still work.');
    }
}

function setDemoStatus(status, message) {
    demo.status = status;
    document.querySelector('#connectionStatus .status-text').textContent = 'Simulation mode';
    demoText('demo-status', message);
    demoElement('demo-start').disabled = status === 'running';
    demoElement('demo-start').textContent = status === 'paused' ? 'Resume' : status === 'complete' ? 'Replay' : 'Start';
    demoElement('demo-pause').disabled = status !== 'running';
}

export function resetDemo() {
    demo.run++; // Invalidates callbacks and in-flight explanations from the previous run.
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
    demoElement('trip-summary').hidden = true;
    for (const id of ['trip-summary-title', 'trip-summary-details', 'trip-summary-next']) demoText(id, '');
    demoText('chart-findings', 'No findings marked yet.');
    for (const id of ['rpm-value', 'speed-value', 'coolant-value', 'load-value', 'intake-air-value', 'battery-value', 'fuel-trim-short-value', 'maf-value']) demoText(id, '—');
    if (demo.chart) {
        demo.chart.data.datasets.splice(3);
        demo.chart.data.datasets.forEach(dataset => { dataset.data = []; });
        demo.chart.update('none');
    }
    if (demo.chart) demoText('chart-status', 'Waiting for readings.');
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
    demoText('recommendation-limitation', 'Simulated readings cannot tell us the condition of your car.');
    demoText('recommendation-evidence', 'Evidence will appear here as readings arrive.');
    demoText('finding-rule', 'Waiting for analysis.');
    demoText('finding-duration', 'Waiting for analysis.');
    setDemoStatus('ready', 'Ready. Choose a scenario and press Start.');
}

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

export function pauseDemo() {
    demo.controller?.pause();
    setDemoStatus('paused', 'Paused. Readings and elapsed time stay here until you resume.');
}

function markFinding(record) {
    if (!record.location) return;
    const { event, location } = record;
    const normal = event.urgency === 'normal';
    const label = findingStatus(event);
    if (demo.chart) {
        demo.chart.data.datasets[normal ? 1 : 2].data.push({ x: location.x, y: location.y,
            finding_label: label, event_id: event.event_id });
        demo.chart.data.datasets.push({ label: `${label}: supporting window`, data: location.points,
            borderColor: normal ? 'rgba(46,125,50,0.25)' : 'rgba(166,95,0,0.3)',
            borderWidth: 10, pointRadius: 0, tension: 0, order: 1 });
        demo.chart.update('none');
    }
    demoText('chart-findings', demo.events.filter(record => record.location).map(({ event, location }) =>
        `${findingStatus(event)} at ${numberText(location.x)} s (${numberText(location.y)} °C); supporting window ${numberText(location.start_s)}–${numberText(location.x)} s.`).join(' '));
}

function completeDemo() {
    setDemoStatus('complete', 'Run complete. Review the trip summary, replay, or choose another scenario.');
    const summary = summarizeTrip(demo.events);
    demoText('trip-summary-title', summary.title);
    demoText('trip-summary-details', summary.details);
    demoText('trip-summary-next', summary.next_step);
    demoElement('trip-summary').hidden = false;
}

/** Shared Reading contract: Celsius, km/h, RPM, percent. Null stays missing. */
export function renderReading(reading) {
    if (reading.scenario_id !== demoElement('demo-scenario').value || reading.source !== 'simulation' ||
        !Number.isFinite(reading.elapsed_s) || !Number.isFinite(reading.timestamp_ms)) return false;
    demo.reading = reading;
    demo.readings.push({ ...reading });
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
    if (demo.chart) {
        demo.chart.data.datasets[0].data.push({ x: reading.elapsed_s, y: Number.isFinite(reading.coolant_c) ? reading.coolant_c : null });
        demo.chart.update('none');
        demoText('chart-status', `Latest: ${numberText(reading.coolant_c)} °C at ${numberText(reading.elapsed_s)} s. Missing readings appear as gaps.`);
    }
    if (!demo.event) {
        demoText('recommendation-title', 'Collecting readings');
        demoText('recommendation-observation', 'The readings are arriving. Waiting for an analysis of the pattern.');
        demoText('recommendation-next', 'Watch the temperature chart as the run continues.');
        demoText('recommendation-urgency', 'Waiting for analysis');
    }
    return true;
}

const evidenceUnits = { coolant_c: '°C', rpm: 'RPM', speed_kmh: 'km/h', engine_load_pct: '%' };
const evidenceLabels = { coolant_c: 'Coolant temperature', rpm: 'Engine speed', speed_kmh: 'Vehicle speed', engine_load_pct: 'Engine load' };
const metricLabel = metric => evidenceLabels[metric] || metric.replaceAll('_', ' ');
function evidenceText(event, includeDuration = true) {
    return event.evidence.map(item => `${metricLabel(item.metric)}: ${numberText(item.start_value)} → ${numberText(item.end_value)} ${evidenceUnits[item.metric] || ''}${includeDuration ? ` over ${numberText(item.duration_s)} s` : ''}.`).join(' ');
}

/** Render the analysis immediately. Explanation requests never block the readings. */
export function renderAnalysis(event, explanation = null, { example = false } = {}) {
    if (!event || typeof event.event_id !== 'string' || event.scenario_id !== demoElement('demo-scenario').value ||
        !Array.isArray(event.evidence) || !Array.isArray(event.limitations) ||
        !['normal', 'attention', 'urgent', 'unknown'].includes(event.urgency) ||
        typeof event.approved_next_step !== 'string') return false;
    if (demo.event?.event_id === event.event_id) return explanation ? renderExplanation(explanation) : true;
    demo.request?.abort();
    // Freeze event evidence locally; future readings or caller mutations cannot change it.
    event = { ...event, evidence: event.evidence.map(item => ({ ...item })), limitations: [...event.limitations] };
    demo.event = event;
    const anchor = demo.readings.find(reading => reading.scenario_id === event.scenario_id && reading.timestamp_ms === event.observed_at_ms);
    const record = { event, elapsed_s: anchor?.elapsed_s ?? null,
        location: ['normal', 'attention', 'urgent'].includes(event.urgency) ? locateFinding(event, demo.readings) : null };
    demo.events.push(record);
    markFinding(record);
    demo.example = example;
    demoText('recommendation-title', findingStatus(event));
    demoElement('recommendation-card').dataset.urgency = event.urgency;
    demoText('recommendation-urgency', { normal: 'Normal pattern', attention: 'Needs attention', urgent: 'Urgent', unknown: 'Not enough information' }[event.urgency]);
    demoText('finding-rule', describeRule(event));
    demoText('recommendation-evidence', evidenceText(event, false) || 'No numeric evidence supplied.');
    demoText('finding-duration', event.evidence.map(item =>
        `${metricLabel(item.metric)}: ${numberText(item.duration_s)} s`).join(' · ') || 'Observation duration not supplied.');
    demoText('recommendation-observation', record.elapsed_s === null
        ? 'This finding could not be matched to a reading in this run.'
        : `Finding at ${numberText(record.elapsed_s)} s. Evidence below stays fixed; gauges show the latest readings.`);
    // Honest, neutral UI fallback; the analysis layer owns the condition and action.
    renderExplanation({ event_id: event.event_id,
        title: event.condition === 'insufficient_data' ? 'Collecting enough readings'
            : event.condition === 'normal_warmup' ? 'Temperature is steady in this window'
            : 'A reading pattern needs your review',
        explanation: 'The analysis is shown in the evidence below. These readings alone cannot establish the vehicle’s condition.',
        next_step: event.approved_next_step, limitation: event.limitations.join(' ') || 'The cause cannot be determined from these readings.', explanation_source: 'template' });
    if (explanation && renderExplanation(explanation)) return true;
    if (!example) void requestExplanation(event);
    return true;
}

export function renderExplanation(explanation) {
    if (!demo.event || explanation?.event_id !== demo.event.event_id ||
        !['ai', 'template'].includes(explanation.explanation_source) ||
        !['title', 'explanation', 'next_step', 'limitation'].every(key => typeof explanation[key] === 'string' && explanation[key].trim())) return false;
    
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
    demoText('recommendation-why', sections.summary || explanation_text);
    demoText('likely-causes', 'The cause cannot be determined from these readings.');
    demoText('why-it-matters', sections.why_it_matters || '—');
    demoText('what-to-do', demo.event.approved_next_step);
    
    // The overall status belongs to A's current event, never the AI title.
    // Approved guidance and limitations always come from the analysis event.
    demoText('recommendation-next', demo.event.approved_next_step);
    const limitations = [...demo.event.limitations];
    if (!limitations.join(' ').includes(explanation.limitation)) limitations.push(explanation.limitation);
    demoText('recommendation-limitation', [...new Set(limitations)].join(' '));
    demoText('explanation-source', demo.example ? 'Example explanation · Temporary preview' : explanation.explanation_source === 'ai' ? 'AI explanation' : 'Template explanation · Fallback');
    return true;
}

async function requestExplanation(event) {
    const run = demo.run;
    const request = new AbortController();
    demo.request = request;
    const timeout = setTimeout(() => request.abort(), 6000);
    try {
        const explanation = demo.adapters.explain
            ? await demo.adapters.explain(event, { signal: request.signal })
            : await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event), signal: request.signal }).then(response => {
                if (!response.ok) throw new Error('Explanation unavailable');
                return response.json();
            });
        if (!request.signal.aborted && run === demo.run && event.event_id === demo.event?.event_id) renderExplanation(explanation);
    } catch {
        // The labeled template remains visible when the endpoint is unavailable.
    } finally {
        clearTimeout(timeout);
        if (demo.request === request) demo.request = null;
    }
}

export function configureDemo({ createSimulation, explain } = {}) {
    resetDemo();
    if (createSimulation) demo.adapters.createSimulation = createSimulation;
    if (explain !== undefined) demo.adapters.explain = explain;
    demoText('demo-mode', demo.adapters.createSimulation === createExamplePreview
        ? 'Example preview · Six fixed readings, played one per second. No vehicle connection needed.'
        : 'Time-compressed simulation · 45-second scenarios. No vehicle connection needed.');
}

window.secondLookUI = { renderReading, renderAnalysis, renderExplanation, configure: configureDemo,
    start: startDemo, pause: pauseDemo, reset: resetDemo };
