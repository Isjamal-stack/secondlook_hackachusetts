# Development Guide

This guide provides step-by-step instructions for continuing development of the ELM327 Vehicle Insights application.

## Quick Start

```bash
# 1. Start the web application
./start.sh

# 2. In another terminal, start the ELM327 emulator (optional, for testing)
cd emulator
python3 start-emulator.py

# 3. Open your browser
# http://localhost:8000
```

## Development Workflow

### Daily Development

1. **Start web server**: `./start.sh` (or `python3 -m http.server 8000`)
2. **Open browser**: Navigate to `http://localhost:8000`
3. **Open DevTools**: F12 or Cmd+Option+I
4. **Make changes**: Edit files in `js/`, `css/`, or `index.html`
5. **Refresh browser**: See changes immediately (Service Worker may cache, use Shift+Refresh)

### Working with Service Worker

**Disable caching during development**:
1. Open DevTools → Application tab
2. Check "Update on reload" under Service Workers
3. This prevents aggressive caching during development

**Clear Service Worker cache**:
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
```

### Testing with Emulator

```bash
# Terminal 1: Start emulator
cd emulator
python3 start-emulator.py

# Terminal 2: Test basic connectivity
python3 test-connection.py

# Terminal 3: Run web server
cd ..
./start.sh
```

## Task Implementation Guide

### Task 3: Web Bluetooth Connection

**File**: `js/bluetooth-manager.js`

**What to implement**:
1. Device discovery with `navigator.bluetooth.requestDevice()`
2. GATT server connection
3. Service and characteristic discovery
4. Read/write operations for serial communication

**Testing**:
- Use Chrome/Edge browser
- Allow Bluetooth permissions
- Connect to emulator (if Bluetooth-enabled) or real ELM327

**Resources**:
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [ELM327 datasheet](https://www.elmelectronics.com/wp-content/uploads/2017/01/ELM327DS.pdf)

### Task 4: ELM327 Protocol

**File**: `js/elm327-protocol.js`

**What to implement**:
1. Initialization sequence:
   - `ATZ` - Reset
   - `ATE0` - Echo off
   - `ATSP0` - Auto protocol
   - `0100` - Supported PIDs (wait for non-SEARCHING response)
2. PID request formatting
3. Response parsing (hex to decimal conversion)
4. Command queue management

**Key functions**:
```javascript
async initialize() {
    await sendCommand('ATZ');
    await sendCommand('ATE0');
    await sendCommand('ATSP0');
    
    // Wait for protocol negotiation
    let response;
    do {
        response = await sendCommand('0100');
    } while (response.includes('SEARCHING'));
    
    return response.startsWith('41 00');
}
```

**Testing**:
- Use Terminal view in Connect page
- Send individual commands
- Verify responses match expected format

### Task 5: Storage & Sample Data

**Files**: 
- `js/storage-manager.js`
- `js/sample-data.js`

**What to implement**:

**StorageManager**:
1. Open IndexedDB connection
2. Create object stores: vehicles, readings, trips, maintenance, dtcHistory
3. Add indexes for efficient queries
4. Implement CRUD operations
5. Add data pruning logic

**Schema**:
```javascript
// vehicles store
{
    vin: '1HGBH41JXMN109186',
    make: 'Toyota',
    model: 'Auris Hybrid',
    year: 2015,
    odometer: 85000
}

// readings store
{
    id: 'reading_123',
    timestamp: '2024-01-15T10:30:00Z',
    trip_id: 'trip_456',
    rpm: 2500,
    speed: 45,
    coolant_temp: 195,
    engine_load: 35,
    fuel_level: 75,
    throttle_pos: 25
}
```

**SampleDataGenerator**:
1. Generate realistic trips (city, highway, mixed)
2. Create readings at 1-second intervals
3. Include DTCs randomly
4. Vary fuel efficiency based on scenario

**Testing**:
- Click "Load Sample Data" in Settings
- Verify data appears in History charts
- Check IndexedDB in DevTools → Application

### Task 6: Web Worker Integration

**File**: `workers/data-worker.js`

**What to implement**:
1. Message protocol between main thread and worker
2. Polling loop (every 1 second)
3. PID request execution
4. Response parsing in worker
5. Send parsed JSON to main thread

**Message flow**:
```javascript
// Main → Worker
{ type: 'START_POLLING', data: { interval: 1000 } }

// Worker → Main
{ 
    type: 'DATA_UPDATE', 
    data: { 
        rpm: 2500, 
        speed: 45, 
        coolant_temp: 195,
        // ...
    } 
}
```

**Benefits**:
- Main thread stays at 60fps for smooth gauges
- Heavy hex parsing doesn't block UI
- Better performance overall

### Tasks 7-15: Feature Implementation

Follow the detailed specifications in the main implementation plan. Each task builds on the previous ones.

## Code Style Guidelines

### JavaScript
- Use ES6+ features (async/await, arrow functions, classes)
- Add JSDoc comments for functions
- Use descriptive variable names
- Handle errors gracefully

```javascript
/**
 * Parse OBD-II PID response
 * @param {string} response - Raw hex response
 * @param {string} pid - PID that was requested
 * @returns {number|null} Parsed value or null if invalid
 */
function parsePIDResponse(response, pid) {
    // Implementation
}
```

### CSS
- Use CSS variables for colors and spacing
- Mobile-first responsive design
- Keep selectors simple and performant

### HTML
- Semantic HTML5 elements
- Accessible (ARIA labels where needed)
- Progressive enhancement

## Debugging Tips

### Browser DevTools

**Console**:
- Check for errors and warnings
- View log messages from app.js, workers, Service Worker

**Network**:
- Verify resources loading correctly
- Check Service Worker caching behavior

**Application**:
- IndexedDB: View stored data
- Service Workers: Debug caching and lifecycle
- Manifest: Verify PWA configuration

**Performance**:
- Profile CPU usage during data collection
- Verify Web Worker offloading works
- Check for 60fps rendering

### Common Issues

**Service Worker won't update**:
- Unregister in DevTools
- Hard refresh (Shift+Cmd+R)
- Clear cache

**Web Bluetooth not working**:
- Check HTTPS (or localhost)
- Verify browser support (Chrome/Edge only)
- Allow permissions when prompted

**Data not persisting**:
- Check IndexedDB in DevTools
- Verify StorageManager initialization
- Look for errors in console

**Worker not responding**:
- Check worker file loaded correctly
- Verify message protocol matches
- Look for errors in worker scope

## Testing Checklist

### Manual Testing

**PWA Features**:
- [ ] App installs via browser prompt
- [ ] Works offline after first load
- [ ] Loads instantly on repeat visits
- [ ] Service Worker caches assets

**Navigation**:
- [ ] All nav buttons work
- [ ] Views switch correctly
- [ ] Active state updates

**Bluetooth (Chrome/Edge)**:
- [ ] Device discovery works
- [ ] Connection succeeds
- [ ] Commands send/receive correctly
- [ ] Disconnection handled gracefully

**Data Storage**:
- [ ] Readings save to IndexedDB
- [ ] Data persists after page reload
- [ ] Export downloads correct JSON
- [ ] Import accepts valid CSV/JSON

**Real-time Display**:
- [ ] Gauges update smoothly (60fps)
- [ ] No UI stuttering during data collection
- [ ] Worker offloads processing

### Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Firefox (file upload only)
- [ ] Safari (file upload only)

### Performance Testing

Targets:
- [ ] Initial load < 2s
- [ ] Subsequent loads < 200ms (cached)
- [ ] 60fps gauge rendering
- [ ] Worker message latency < 100ms

## Git Workflow

```bash
# Before starting work
git status
git pull

# Create feature branch
git checkout -b feature/task-3-bluetooth

# Make changes and commit
git add js/bluetooth-manager.js
git commit -m "Implement Web Bluetooth connection"

# Push to remote
git push origin feature/task-3-bluetooth

# Merge when complete
git checkout main
git merge feature/task-3-bluetooth
```

## Useful Commands

```bash
# Start web server on different port
python3 -m http.server 3000

# Check Python version
python3 --version

# Install emulator
python3 -m pip install ELM327-emulator

# Start emulator with verbose logging
python3 emulator/start-emulator.py --verbose

# Test emulator connection
python3 emulator/test-connection.py

# Generate icons (open in browser)
open icons/generate-icons.html

# View project structure
tree -I 'node_modules|__pycache__|.git'
```

## Resources

### Documentation
- [MDN Web Docs](https://developer.mozilla.org/)
- [Web Bluetooth API](https://webbluetoothcg.github.io/web-bluetooth/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [PWA Guide](https://web.dev/progressive-web-apps/)

### OBD-II Specifications
- [ELM327 Command Set](https://www.elmelectronics.com/wp-content/uploads/2017/01/ELM327DS.pdf)
- [OBD-II PIDs (Wikipedia)](https://en.wikipedia.org/wiki/OBD-II_PIDs)
- [SAE J1979 Standard](https://www.sae.org/standards/content/j1979_201202/)

### Tools
- [ELM327 Emulator GitHub](https://github.com/Ircama/ELM327-emulator)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Lighthouse PWA Audit](https://developers.google.com/web/tools/lighthouse)

## Support

For questions or issues:
1. Check PROJECT_STATUS.md for current state
2. Review README.md for setup instructions
3. Check browser console for errors
4. Verify emulator is running (if testing Bluetooth)

---

Happy coding! 🚗💨
