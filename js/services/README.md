# Services Directory

This directory contains core business logic services that handle external integrations and data operations.

## Files

### `bluetooth-manager.js`
**Purpose**: Web Bluetooth API integration for ELM327 OBD-II adapters

**Responsibilities**:
- Connect to Bluetooth OBD-II adapters
- Send AT commands and OBD-II PIDs
- Handle characteristic notifications
- Manage connection state
- Support TCP emulator mode for development

**Key Methods**:
- `connect()` - Connect to Bluetooth device
- `sendCommand(command)` - Send command and wait for response
- `disconnect()` - Disconnect from device
- `simulateResponse(command)` - Mock responses for testing

**Dependencies**: `utils/logger.js`, `utils/error-handler.js`

---

### `storage-manager.js`
**Purpose**: IndexedDB persistence layer for local data storage

**Responsibilities**:
- Initialize and manage IndexedDB database
- Store and retrieve vehicle readings
- Manage trip data and history
- Store maintenance records
- Handle DTC (diagnostic trouble code) history
- Export and clear data

**Database Schema**:
- `vehicles` - Vehicle profile data
- `readings` - Time-series OBD-II readings
- `trips` - Aggregated trip information
- `maintenance` - Maintenance records
- `dtcHistory` - Diagnostic trouble code history
- `settings` - Application settings

**Key Methods**:
- `init()` - Initialize database
- `storeReading(reading)` - Save single reading
- `getReadings(startDate, endDate)` - Query readings by date
- `exportData()` - Export all data as JSON
- `clearAll()` - Clear all stored data

**Dependencies**: `utils/logger.js`, `utils/error-handler.js`

---

### `elm327-protocol.js`
**Purpose**: ELM327 AT command and OBD-II PID protocol handler

**Responsibilities**:
- Initialize ELM327 adapter with AT commands
- Encode and decode OBD-II PIDs
- Handle protocol negotiation
- Parse PID responses
- Read and parse diagnostic trouble codes (DTCs)
- Decode various vehicle metrics

**Supported PIDs**:
- `0C` - Engine RPM
- `0D` - Vehicle Speed
- `05` - Coolant Temperature
- `04` - Engine Load
- `2F` - Fuel Level
- `11` - Throttle Position
- `0F` - Intake Air Temperature
- `10` - Mass Air Flow (MAF)

**Key Methods**:
- `initialize(sendCommandFn)` - Initialize adapter
- `requestPID(pid)` - Request single PID value
- `requestMultiplePIDs(pids)` - Request multiple PIDs
- `readDTCs()` - Read diagnostic trouble codes
- `clearDTCs()` - Clear stored DTCs

**Dependencies**: `utils/logger.js`, `utils/error-handler.js`

---

## Usage Examples

### Bluetooth Manager
```javascript
import { BluetoothManager } from './services/bluetooth-manager.js';

const bluetooth = new BluetoothManager();

// Connect to device
await bluetooth.connect();

// Send command
const response = await bluetooth.sendCommand('010C'); // Request RPM

// Disconnect
await bluetooth.disconnect();
```

### Storage Manager
```javascript
import { StorageManager } from './services/storage-manager.js';

const storage = new StorageManager();

// Initialize
await storage.init();

// Store reading
await storage.storeReading({
    timestamp: new Date().toISOString(),
    rpm: 2000,
    speed: 60,
    coolant_temp: 90
});

// Query readings
const readings = await storage.getReadings(startDate, endDate);
```

### ELM327 Protocol
```javascript
import { ELM327Protocol } from './services/elm327-protocol.js';

const protocol = new ELM327Protocol();

// Initialize with send function
await protocol.initialize(async (cmd) => {
    return await bluetooth.sendCommand(cmd);
});

// Request PID
const rpm = await protocol.requestPID('0C');
console.log('RPM:', rpm);
```

## Design Patterns

### Service Pattern
Each service encapsulates a specific domain of functionality:
- Clear single responsibility
- Well-defined public API
- Internal state management
- Error handling with categorization

### Dependency Injection
Services receive dependencies through constructor or method parameters:
- Easier to test (can inject mocks)
- Loose coupling
- Flexible configuration

### Async/Promise-Based
All I/O operations return Promises:
- Non-blocking operations
- Consistent error handling
- Easy to compose with async/await

## Testing Considerations

### Bluetooth Manager
- Mock Web Bluetooth API for tests
- Use `simulateResponse()` for development
- Test connection/disconnection flow
- Test command timeout handling

### Storage Manager
- Use in-memory IndexedDB for tests
- Test CRUD operations
- Test date range queries
- Test data migration

### ELM327 Protocol
- Mock `sendCommandFn` for tests
- Test PID encoding/decoding
- Test protocol initialization
- Test error responses

## Future Enhancements

### Bluetooth Manager
- [ ] Support multiple simultaneous connections
- [ ] Add connection quality monitoring
- [ ] Implement reconnection logic
- [ ] Add WebSocket bridge for TCP

### Storage Manager
- [ ] Add data compression
- [ ] Implement cloud sync
- [ ] Add encryption for sensitive data
- [ ] Create backup/restore functionality

### ELM327 Protocol
- [ ] Support more PIDs
- [ ] Add CAN filtering
- [ ] Implement advanced diagnostic features
- [ ] Support multiple protocols (J1850, ISO9141, etc.)

---

**Last Updated**: October 24, 2026  
**Maintainer**: SecondLook Team
