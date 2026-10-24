/**
 * Main Application Entry Point
 * Handles app initialization, routing, and UI interactions
 */

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
        registerServiceWorker();
        
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
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('[App] File selected:', file.name);
    
    try {
        showLoading('Importing data...');
        
        const text = await file.text();
        let data;
        
        // Parse based on file type
        if (file.name.endsWith('.json')) {
            data = JSON.parse(text);
            console.log('[App] JSON data parsed:', Object.keys(data));
        } else if (file.name.endsWith('.csv')) {
            data = parseCSV(text);
            console.log('[App] CSV data parsed:', data.length, 'rows');
        } else {
            throw new Error('Unsupported file format');
        }
        
        // TODO: Import data to IndexedDB
        // This will be implemented in Task 5 & 9
        
        showToast(`Imported ${file.name} successfully`);
        hideLoading();
        
    } catch (error) {
        console.error('[App] File upload failed:', error);
        showToast('Import failed: ' + error.message, 'error');
        hideLoading();
    }
    
    // Reset file input
    event.target.value = '';
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
    document.getElementById('rpm-value').textContent = data.rpm || 0;
    document.getElementById('speed-value').textContent = data.speed || 0;
    document.getElementById('coolant-value').textContent = data.coolant_temp || 0;
    document.getElementById('load-value').textContent = data.engine_load || 0;
    document.getElementById('fuel-value').textContent = data.fuel_level || 0;
    document.getElementById('throttle-value').textContent = data.throttle_pos || 0;
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
