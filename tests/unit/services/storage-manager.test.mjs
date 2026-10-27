/**
 * @fileoverview Unit tests for storage manager
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockIndexedDB, createMockDatabase } from '../../helpers/mock-storage.mjs';
import { createMockReading, createMockSession, wait } from '../../helpers/test-utils.mjs';

// Create test storage manager with mocked IndexedDB
class TestStorageManager {
  constructor(mockDB) {
    this.db = mockDB;
    this.dbName = 'VehicleInsightsDB';
    this.dbVersion = 1;
  }
  
  async storeReading(reading) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readwrite');
      const store = transaction.objectStore('readings');
      const request = store.add(reading);
      
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async storeReadings(readings) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readwrite');
      const store = transaction.objectStore('readings');
      
      let count = 0;
      readings.forEach(reading => {
        const request = store.add(reading);
        request.addEventListener('success', () => count++);
      });
      
      // Simulate transaction complete
      setTimeout(() => resolve(count), 10);
    });
  }
  
  async getReadings(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readonly');
      const store = transaction.objectStore('readings');
      const request = store.getAll();
      
      request.addEventListener('success', () => {
        const allReadings = request.result;
        const startTime = new Date(startDate).getTime();
        const endTime = new Date(endDate).getTime();
        
        const filtered = allReadings.filter(r => {
          const readingTime = new Date(r.timestamp).getTime();
          return readingTime >= startTime && readingTime <= endTime;
        });
        
        resolve(filtered);
      });
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async getLatestReading() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readonly');
      const store = transaction.objectStore('readings');
      const request = store.getAll();
      
      request.addEventListener('success', () => {
        const readings = request.result;
        if (readings.length === 0) {
          resolve(null);
        } else {
          const sorted = readings.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          );
          resolve(sorted[0]);
        }
      });
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async getAllReadings() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['readings'], 'readonly');
      const store = transaction.objectStore('readings');
      const request = store.getAll();
      
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async storeVehicle(vehicle) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['vehicles'], 'readwrite');
      const store = transaction.objectStore('vehicles');
      const request = store.put(vehicle);
      
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async getVehicle() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['vehicles'], 'readonly');
      const store = transaction.objectStore('vehicles');
      const request = store.getAll();
      
      request.addEventListener('success', () => {
        const vehicles = request.result;
        resolve(vehicles.length > 0 ? vehicles[0] : null);
      });
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async storeSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.addEventListener('success', () => {
        resolve(request.result ? request.result.value : null);
      });
      request.addEventListener('error', () => reject(request.error));
    });
  }
  
  async clearAll() {
    const stores = ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
    }
    
    await wait(10); // Wait for operations to complete
  }
}

test('StorageManager - stores single reading', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const reading = createMockReading({ id: 1 });
  const id = await storage.storeReading(reading);
  
  assert.ok(id);
});

test('StorageManager - retrieves stored reading', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const reading = createMockReading({ id: 1, timestamp: new Date().toISOString() });
  await storage.storeReading(reading);
  
  const readings = await storage.getAllReadings();
  
  assert.equal(readings.length, 1);
  assert.equal(readings[0].rpm, reading.rpm);
});

test('StorageManager - stores multiple readings in bulk', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const readings = [
    createMockReading({ id: 1 }),
    createMockReading({ id: 2 }),
    createMockReading({ id: 3 })
  ];
  
  const count = await storage.storeReadings(readings);
  
  assert.equal(count, 3);
});

test('StorageManager - retrieves readings by date range', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const now = new Date();
  const oneHourAgo = new Date(now - 3600000);
  const twoHoursAgo = new Date(now - 7200000);
  
  await storage.storeReading(createMockReading({ id: 1, timestamp: twoHoursAgo.toISOString() }));
  await storage.storeReading(createMockReading({ id: 2, timestamp: oneHourAgo.toISOString() }));
  await storage.storeReading(createMockReading({ id: 3, timestamp: now.toISOString() }));
  
  const readings = await storage.getReadings(oneHourAgo, now);
  
  assert.equal(readings.length, 2);
});

test('StorageManager - gets latest reading', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const now = new Date();
  const earlier = new Date(now - 3600000);
  
  await storage.storeReading(createMockReading({ id: 1, timestamp: earlier.toISOString(), rpm: 1000 }));
  await storage.storeReading(createMockReading({ id: 2, timestamp: now.toISOString(), rpm: 2000 }));
  
  const latest = await storage.getLatestReading();
  
  assert.equal(latest.rpm, 2000);
});

test('StorageManager - returns null when no readings exist', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const latest = await storage.getLatestReading();
  
  assert.equal(latest, null);
});

test('StorageManager - stores vehicle information', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const vehicle = {
    id: 'vehicle-1',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    vin: '1234567890ABCDEFG'
  };
  
  await storage.storeVehicle(vehicle);
  const retrieved = await storage.getVehicle();
  
  assert.equal(retrieved.make, 'Toyota');
  assert.equal(retrieved.model, 'Camry');
  assert.equal(retrieved.year, 2020);
});

test('StorageManager - updates vehicle information', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const vehicle = { id: 'vehicle-1', make: 'Toyota', model: 'Camry' };
  await storage.storeVehicle(vehicle);
  
  const updated = { id: 'vehicle-1', make: 'Honda', model: 'Accord' };
  await storage.storeVehicle(updated);
  
  const retrieved = await storage.getVehicle();
  
  assert.equal(retrieved.make, 'Honda');
  assert.equal(retrieved.model, 'Accord');
});

test('StorageManager - returns null when no vehicle exists', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const vehicle = await storage.getVehicle();
  
  assert.equal(vehicle, null);
});

test('StorageManager - stores settings', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeSetting('theme', 'dark');
  const value = await storage.getSetting('theme');
  
  assert.equal(value, 'dark');
});

test('StorageManager - updates existing settings', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeSetting('theme', 'light');
  await storage.storeSetting('theme', 'dark');
  
  const value = await storage.getSetting('theme');
  
  assert.equal(value, 'dark');
});

test('StorageManager - returns null for non-existent setting', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const value = await storage.getSetting('nonexistent');
  
  assert.equal(value, null);
});

test('StorageManager - stores multiple independent settings', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeSetting('theme', 'dark');
  await storage.storeSetting('units', 'metric');
  await storage.storeSetting('notifications', true);
  
  assert.equal(await storage.getSetting('theme'), 'dark');
  assert.equal(await storage.getSetting('units'), 'metric');
  assert.equal(await storage.getSetting('notifications'), true);
});

test('StorageManager - clears all data', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeReading(createMockReading({ id: 1 }));
  await storage.storeVehicle({ id: 'v1', make: 'Toyota' });
  await storage.storeSetting('theme', 'dark');
  
  await storage.clearAll();
  
  const readings = await storage.getAllReadings();
  const vehicle = await storage.getVehicle();
  const setting = await storage.getSetting('theme');
  
  assert.equal(readings.length, 0);
  assert.equal(vehicle, null);
  assert.equal(setting, null);
});

test('StorageManager - handles concurrent reads', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeReading(createMockReading({ id: 1 }));
  
  const [readings1, readings2, readings3] = await Promise.all([
    storage.getAllReadings(),
    storage.getAllReadings(),
    storage.getAllReadings()
  ]);
  
  assert.equal(readings1.length, 1);
  assert.equal(readings2.length, 1);
  assert.equal(readings3.length, 1);
});

test('StorageManager - handles empty date range query', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  await storage.storeReading(createMockReading({ id: 1, timestamp: new Date('2024-01-01').toISOString() }));
  
  const readings = await storage.getReadings(
    new Date('2024-06-01'),
    new Date('2024-06-30')
  );
  
  assert.equal(readings.length, 0);
});

test('StorageManager - preserves reading data types', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const reading = {
    id: 1,
    timestamp: new Date().toISOString(),
    rpm: 2000,
    speed: 60.5,
    coolant: 90,
    engineLoad: 35.7,
    metadata: { source: 'real', device: 'ELM327' }
  };
  
  await storage.storeReading(reading);
  const readings = await storage.getAllReadings();
  
  assert.equal(typeof readings[0].rpm, 'number');
  assert.equal(typeof readings[0].speed, 'number');
  assert.equal(typeof readings[0].metadata, 'object');
});

test('StorageManager - handles large number of readings', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const readings = [];
  for (let i = 0; i < 100; i++) {
    readings.push(createMockReading({ id: i }));
  }
  
  const count = await storage.storeReadings(readings);
  
  assert.equal(count, 100);
});

test('StorageManager - filters readings by exact date boundaries', async () => {
  const db = createMockDatabase({ stores: ['readings', 'vehicles', 'settings', 'trips', 'maintenance', 'dtcHistory'] });
  const storage = new TestStorageManager(db);
  
  const start = new Date('2024-01-01T00:00:00Z');
  const middle = new Date('2024-01-15T12:00:00Z');
  const end = new Date('2024-01-31T23:59:59Z');
  const before = new Date('2023-12-31T23:59:59Z');
  const after = new Date('2024-02-01T00:00:00Z');
  
  await storage.storeReading(createMockReading({ id: 1, timestamp: before.toISOString() }));
  await storage.storeReading(createMockReading({ id: 2, timestamp: start.toISOString() }));
  await storage.storeReading(createMockReading({ id: 3, timestamp: middle.toISOString() }));
  await storage.storeReading(createMockReading({ id: 4, timestamp: end.toISOString() }));
  await storage.storeReading(createMockReading({ id: 5, timestamp: after.toISOString() }));
  
  const readings = await storage.getReadings(start, end);
  
  assert.equal(readings.length, 3);
  assert.equal(readings.some(r => r.id === 1), false);
  assert.equal(readings.some(r => r.id === 5), false);
});
