# Testing Guide - Current Build

## What You Can Test Right Now

Even though the core features aren't implemented yet, you can test and verify:
- ✅ PWA functionality
- ✅ UI/UX and navigation
- ✅ Service Worker caching
- ✅ Responsive design
- ✅ ELM327 emulator connectivity

---

## Method 1: Test the Web Application UI

### Start the Web Server

```bash
cd /Users/ismailjamal/Documents/ismailjamal_hackachusettsproject
./start.sh
```

**Or manually:**
```bash
python3 -m http.server 8000
```

### Open in Browser

Navigate to: **http://localhost:8000**

### What to Test

#### ✅ Navigation
1. Click each nav item (Dashboard, Connect, Diagnostics, History, Maintenance, Settings)
2. ✓ Verify views switch correctly
3. ✓ Check active state highlights current view

#### ✅ Dashboard View
1. See 6 metric cards (RPM, Speed, Coolant, Load, Fuel, Throttle)
2. Currently shows zeros (will update when data collection works)
3. ✓ Layout should be clean and organized

#### ✅ Connect View
1. See two connection options:
   - **Web Bluetooth** (shows support status)
   - **File Upload** (ready but not functional yet)
2. Check browser support indicator:
   - Chrome/Edge: "✓ Web Bluetooth supported"
   - Firefox/Safari: "✗ Web Bluetooth not supported..."
3. Try clicking "Connect Device" (will show permission dialog but won't connect yet)

#### ✅ Diagnostics View
1. See "Active Trouble Codes" section (empty for now)
2. See "Code History" section (empty for now)
3. Layout is ready for data

#### ✅ History View
1. See date range selector (7 days, 30 days, all time)
2. See metric selector (RPM, Speed, Temperature, Fuel)
3. Chart area is ready (will show data once storage works)

#### ✅ Maintenance View
1. See 3 maintenance cards:
   - Oil Change
   - Tire Rotation
   - Inspection
2. Progress bars show 0% (will calculate when data available)

#### ✅ Settings View
1. See vehicle profile form (VIN, Make, Model, Year)
2. See units selector (Imperial/Metric)
3. See data management buttons:
   - "Load Sample Data" (not functional yet)
   - "Export All Data" (will download empty JSON)
   - "Clear All Data" (shows confirmation)

#### ✅ PWA Features

**Test PWA Installation:**
1. Look for install icon in Chrome/Edge address bar
2. Click to install
3. ✓ App should install to your system
4. ✓ Launch installed app - should open in standalone window

**Test Offline Mode:**
1. With app loaded, open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from dropdown
4. Refresh page
5. ✓ App should still load (from Service Worker cache)

**Test Service Worker:**
1. Open DevTools → Application tab
2. Click "Service Workers" in left sidebar
3. ✓ Should see service worker registered
4. ✓ Status should be "activated and running"

#### ✅ Responsive Design
1. Resize browser window
2. ✓ Layout should adapt smoothly
3. Try mobile view (DevTools → Toggle Device Toolbar)
4. ✓ Navigation should remain accessible

#### ✅ Notifications
1. Click "Export All Data" in Settings
2. ✓ Should see toast notification at bottom
3. ✓ Should download JSON file (empty for now)

---

## Method 2: Test the ELM327 Emulator

### Start Emulator

```bash
cd /Users/ismailjamal/Documents/ismailjamal_hackachusettsproject/emulator
python3 start-emulator.py
```

**Expected Output:**
```
============================================================
🚗 ELM327 Emulator Starting
============================================================
Port:     35000
Scenario: car
Protocol: Auto-detect (CAN/ISO/KWP)

The emulator simulates a Toyota Auris Hybrid vehicle.
Connect your application to localhost:35000 to begin testing.

Common test commands:
  ATZ        - Reset ELM327
  ATSP0      - Set protocol to auto
  0100       - Get supported PIDs
  010C       - Get engine RPM
  010D       - Get vehicle speed

Press Ctrl+C to stop the emulator
============================================================
```

### Test Emulator Connectivity

**Open a second terminal:**

```bash
cd /Users/ismailjamal/Documents/ismailjamal_hackachusettsproject/emulator
python3 test-connection.py
```

**Expected Output:**
```
============================================================
🔧 ELM327 Emulator Connection Test
============================================================
Connecting to localhost:35000...
✅ Connected!

Test 1: Sending ATZ (reset)...
Response: ELM327 v2.3
✅ Reset successful - ELM327 identified

Test 2: Sending ATE0 (echo off)...
Response: OK
✅ Echo disabled

Test 3: Sending 0100 (supported PIDs)...
Response: 41 00 BE 1F A8 13
✅ PID request successful

Test 4: Sending 010C (engine RPM)...
Response: 41 0C 0C 1C
✅ RPM request successful

============================================================
✅ All tests completed successfully!
============================================================
```

### Manual Commands (Advanced)

You can connect directly to the emulator using netcat or telnet:

```bash
# Using netcat
nc localhost 35000

# Then type commands:
ATZ
0100
010C
010D
```

---

## Method 3: Browser Developer Tools Testing

### Console Testing

Open DevTools Console (F12) and try:

```javascript
// Check app is loaded
console.log(window.app);

// Check Service Worker
navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('Service Workers:', regs);
});

// Check Web Bluetooth support
console.log('Bluetooth supported:', 'bluetooth' in navigator);

// Test toast notification
showToast('Test notification!');

// Test loading overlay
showLoading('Testing...');
setTimeout(hideLoading, 2000);
```

### Application Tab

1. **Service Workers**
   - ✓ Should show registered worker
   - ✓ Status: activated and running

2. **Manifest**
   - ✓ Should load manifest.json
   - ✓ Shows app name, icons, theme color

3. **Cache Storage**
   - ✓ Should show cache entries
   - ✓ Static assets cached

4. **IndexedDB**
   - Currently empty (will have data after Task 5)

### Network Tab

1. Load app with Network tab open
2. ✓ Should see all resources load
3. Refresh page
4. ✓ Resources should load from Service Worker

### Performance Tab

1. Start recording
2. Navigate between views
3. Stop recording
4. ✓ Should see smooth performance (60fps)
5. ✓ No long tasks or jank

---

## Method 4: Lighthouse PWA Audit

### Run Lighthouse Audit

1. Open DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"

### Expected Scores

**Should Pass:**
- ✅ Installable
- ✅ PWA Optimized
- ✅ Works offline
- ✅ Has manifest
- ✅ Has service worker
- ✅ Registers service worker
- ✅ Themed

**May Not Pass Yet:**
- ⚠️ Has icons (need to generate)
- ⚠️ Has screenshots (optional)

---

## Method 5: Mobile Testing

### Using Device Simulator

1. Open DevTools → Toggle Device Toolbar (Cmd+Shift+M)
2. Select device (iPhone, iPad, Pixel, etc.)
3. Test all views
4. ✓ Layout should be responsive
5. ✓ Touch interactions should work

### Using Real Device

1. Get your computer's local IP:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. Start server:
   ```bash
   python3 -m http.server 8000
   ```

3. On mobile device, navigate to:
   ```
   http://YOUR_IP:8000
   ```

4. Test PWA installation on mobile

---

## What Works vs What Doesn't

### ✅ Working Now

| Feature | Status | Notes |
|---------|--------|-------|
| UI Rendering | ✅ | All views display correctly |
| Navigation | ✅ | Switch between views works |
| PWA Install | ✅ | Can install as app |
| Service Worker | ✅ | Caching works |
| Offline Mode | ✅ | Loads without network |
| Responsive Design | ✅ | Works on all screen sizes |
| Toast Notifications | ✅ | Shows messages |
| Loading Overlay | ✅ | Shows/hides correctly |
| Browser Detection | ✅ | Detects Bluetooth support |
| ELM327 Emulator | ✅ | Runs and responds |

### 🔨 Not Functional Yet

| Feature | Status | Why |
|---------|--------|-----|
| Bluetooth Connection | 🔨 | Task 3 not implemented |
| Live Data Display | 🔨 | Tasks 3-6 needed |
| Data Storage | 🔨 | Task 5 not implemented |
| Charts | 🔨 | Task 8 not implemented |
| DTC Reading | 🔨 | Task 7 not implemented |
| File Upload | 🔨 | Task 9 not implemented |
| Maintenance Tracking | 🔨 | Task 10 not implemented |
| Sample Data | 🔨 | Task 5 not implemented |

---

## Expected Behavior Summary

### What You'll See
- ✅ Clean, professional UI
- ✅ Smooth navigation
- ✅ All views render correctly
- ✅ PWA install prompt
- ✅ Works offline after first load
- ✅ Responsive layout
- ✅ Browser support detection

### What Won't Work Yet
- ❌ Can't actually connect to ELM327
- ❌ Dashboard metrics stay at 0
- ❌ No data persists
- ❌ Charts are empty
- ❌ File upload button doesn't work
- ❌ Sample data button doesn't work
- ❌ No DTCs display

### What's Ready
- ✅ UI framework complete
- ✅ PWA infrastructure working
- ✅ Testing environment ready
- ✅ Class stubs prepared
- ✅ Emulator functional

---

## Console Output to Expect

When you open the app, console should show:

```
[App] Initializing...
[App] Service Worker registered: ServiceWorkerRegistration
[BluetoothManager] Module loaded
[ELM327Protocol] Module loaded
[SampleDataGenerator] Module loaded
[StorageManager] Module loaded
[DataWorker] Worker thread started
[DataWorker] Ready to receive messages
[App] Initialization complete
[App] Module loaded
```

**No errors should appear!**

---

## Quick Test Checklist

Copy this to verify everything works:

```
□ Web server starts without errors
□ App loads at http://localhost:8000
□ No console errors
□ All 6 nav items work
□ Views switch correctly
□ Install prompt appears (Chrome/Edge)
□ Can install as PWA
□ Service Worker registers
□ App works offline
□ Responsive on mobile view
□ Toast notifications work
□ Loading overlay works
□ Emulator starts successfully
□ Emulator test script passes
□ Browser shows Bluetooth support status correctly
```

---

## Troubleshooting

### Port 8000 Already in Use
```bash
# Try different port
python3 -m http.server 3000
```

### Service Worker Not Updating
```bash
# In browser console:
navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
# Then hard refresh (Shift+Cmd+R)
```

### Emulator Won't Start
```bash
# Reinstall emulator
cd emulator
bash setup.sh
```

### Icons Not Loading
- Icons aren't created yet
- App still works, just missing visual icons
- Use `icons/generate-icons.html` to create them

---

## Next Testing Phase

After implementing Tasks 3-5, you'll be able to test:
- ✅ Bluetooth connection to emulator
- ✅ Real-time data updates
- ✅ Data persistence
- ✅ Sample data generation
- ✅ Live gauge updates at 60fps

---

**Happy Testing! 🚗💨**

For questions, check:
- README.md - Full documentation
- DEVELOPMENT.md - Developer guide
- PROJECT_STATUS.md - What's complete
