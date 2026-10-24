/**
 * Storage Manager Module
 * Handles IndexedDB operations for local data persistence
 */

export class StorageManager {
    constructor() {
        this.db = null;
        this.dbName = 'VehicleInsightsDB';
        this.dbVersion = 1;
    }
    
    /**
     * Initialize database with schema
     */
    async init() {
        return new Promise((resolve, reject) => {
            console.log('[StorageManager] Initializing database...');
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('[StorageManager] Database error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[StorageManager] Database initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('[StorageManager] Creating database schema...');
                
                // Vehicle profile store
                if (!db.objectStoreNames.contains('vehicles')) {
                    const vehicleStore = db.createObjectStore('vehicles', { keyPath: 'id' });
                    vehicleStore.createIndex('vin', 'vin', { unique: true });
                    console.log('[StorageManager] Created vehicles store');
                }
                
                // Readings store (time-series data)
                if (!db.objectStoreNames.contains('readings')) {
                    const readingStore = db.createObjectStore('readings', { keyPath: 'id', autoIncrement: true });
                    readingStore.createIndex('timestamp', 'timestamp', { unique: false });
                    readingStore.createIndex('trip_id', 'trip_id', { unique: false });
                    console.log('[StorageManager] Created readings store');
                }
                
                // Trips store (aggregated trip data)
                if (!db.objectStoreNames.contains('trips')) {
                    const tripStore = db.createObjectStore('trips', { keyPath: 'id' });
                    tripStore.createIndex('start_time', 'start_time', { unique: false });
                    tripStore.createIndex('end_time', 'end_time', { unique: false });
                    console.log('[StorageManager] Created trips store');
                }
                
                // Maintenance records store
                if (!db.objectStoreNames.contains('maintenance')) {
                    const maintenanceStore = db.createObjectStore('maintenance', { keyPath: 'id' });
                    maintenanceStore.createIndex('date', 'date', { unique: false });
                    maintenanceStore.createIndex('type', 'type', { unique: false });
                    console.log('[StorageManager] Created maintenance store');
                }
                
                // DTC history store
                if (!db.objectStoreNames.contains('dtcHistory')) {
                    const dtcStore = db.createObjectStore('dtcHistory', { keyPath: 'id', autoIncrement: true });
                    dtcStore.createIndex('code', 'code', { unique: false });
                    dtcStore.createIndex('detected_at', 'detected_at', { unique: false });
                    console.log('[StorageManager] Created dtcHistory store');
                }
                
                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                    console.log('[StorageManager] Created settings store');
                }
                
                console.log('[StorageManager] Schema creation complete');
            };
        });
    }
    
    /**
     * Store vehicle reading
     */
    async storeReading(reading) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readwrite');
            const store = transaction.objectStore('readings');
            const request = store.add(reading);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store multiple readings (bulk insert)
     */
    async storeReadings(readings) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readwrite');
            const store = transaction.objectStore('readings');
            
            let count = 0;
            readings.forEach(reading => {
                const request = store.add(reading);
                request.onsuccess = () => count++;
            });
            
            transaction.oncomplete = () => {
                console.log(`[StorageManager] Stored ${count} readings`);
                resolve(count);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /**
     * Get readings by date range
     */
    async getReadings(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readonly');
            const store = transaction.objectStore('readings');
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.bound(
                startDate instanceof Date ? startDate.toISOString() : startDate,
                endDate instanceof Date ? endDate.toISOString() : endDate
            );
            
            const request = index.getAll(range);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get latest reading
     */
    async getLatestReading() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readonly');
            const store = transaction.objectStore('readings');
            const index = store.index('timestamp');
            
            const request = index.openCursor(null, 'prev');
            
            request.onsuccess = () => {
                const cursor = request.result;
                resolve(cursor ? cursor.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store vehicle profile
     */
    async storeVehicle(vehicle) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['vehicles'], 'readwrite');
            const store = transaction.objectStore('vehicles');
            
            // Ensure vehicle has an ID
            if (!vehicle.id) {
                vehicle.id = 'vehicle_1';
            }
            
            const request = store.put(vehicle);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get vehicle profile
     */
    async getVehicle() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['vehicles'], 'readonly');
            const store = transaction.objectStore('vehicles');
            const request = store.get('vehicle_1');
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store trip data
     */
    async storeTrip(trip) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trips'], 'readwrite');
            const store = transaction.objectStore('trips');
            const request = store.put(trip);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get all trips
     */
    async getTrips() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['trips'], 'readonly');
            const store = transaction.objectStore('trips');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store maintenance record
     */
    async storeMaintenance(record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['maintenance'], 'readwrite');
            const store = transaction.objectStore('maintenance');
            
            if (!record.id) {
                record.id = `maint_${Date.now()}`;
            }
            
            const request = store.put(record);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get all maintenance records
     */
    async getMaintenanceRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['maintenance'], 'readonly');
            const store = transaction.objectStore('maintenance');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store DTC (Diagnostic Trouble Code)
     */
    async storeDTC(dtc) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dtcHistory'], 'readwrite');
            const store = transaction.objectStore('dtcHistory');
            const request = store.add(dtc);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get DTC history
     */
    async getDTCHistory() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dtcHistory'], 'readonly');
            const store = transaction.objectStore('dtcHistory');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Store setting
     */
    async storeSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get setting
     */
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Prune old data (data retention strategy)
     */
    async pruneOldData() {
        console.log('[StorageManager] Pruning old data...');
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readwrite');
            const store = transaction.objectStore('readings');
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.upperBound(thirtyDaysAgo.toISOString());
            const request = index.openCursor(range);
            
            let count = 0;
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    count++;
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                console.log(`[StorageManager] Pruned ${count} old readings`);
                resolve(count);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /**
     * Export all data
     */
    async exportData() {
        const [vehicle, readings, trips, maintenance, dtcHistory] = await Promise.all([
            this.getVehicle(),
            this.getAllReadings(),
            this.getTrips(),
            this.getMaintenanceRecords(),
            this.getDTCHistory()
        ]);
        
        return {
            version: '1.0',
            exported_at: new Date().toISOString(),
            vehicle: vehicle || {},
            readings: readings || [],
            trips: trips || [],
            maintenance: maintenance || [],
            dtc_history: dtcHistory || []
        };
    }
    
    /**
     * Get all readings (for export)
     */
    async getAllReadings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['readings'], 'readonly');
            const store = transaction.objectStore('readings');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Clear all data
     */
    async clearAll() {
        console.log('[StorageManager] Clearing all data...');
        
        const stores = ['vehicles', 'readings', 'trips', 'maintenance', 'dtcHistory', 'settings'];
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(stores, 'readwrite');
            
            stores.forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });
            
            transaction.oncomplete = () => {
                console.log('[StorageManager] All data cleared');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    /**
     * Get storage usage estimate
     */
    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        }
        return null;
    }
}

console.log('[StorageManager] Module loaded');
