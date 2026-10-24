<img width="1672" height="941" alt="16727805-523D-436D-BEE3-EE32DD00736A" src="https://github.com/user-attachments/assets/579de4bc-c48f-4b22-aeba-5f507da71143" />
<img width="1254" height="1254" alt="SecondLook geometric brand identity-1" src="https://github.com/user-attachments/assets/dd78ae60-fc45-437d-87df-0161a9aa607b" />
# ELM327 Vehicle Insights Web Application

A Progressive Web Application for monitoring vehicle health, predicting maintenance needs, and analyzing driving performance using ELM327 OBD-II adapters.

## Features

- **Real-time Monitoring**: Display live vehicle metrics (RPM, speed, temperature, fuel) at 60fps
- **Web Bluetooth Support**: Direct connection to ELM327 adapters (Chrome/Edge)
- **File Upload**: Manual data import for iOS and other platforms
- **Maintenance Predictions**: Time and mileage-based service interval tracking
- **Diagnostic Codes**: Read and decode DTCs with descriptions
- **Fuel Efficiency**: Track and analyze fuel economy trends
- **Driving Behavior**: Score driving patterns with improvement suggestions
- **Offline-First**: Full PWA support with Service Worker caching
- **Privacy-Focused**: All data stored locally in browser (no cloud)

## Architecture

### Multi-threaded Design
- **Main Thread**: 60fps UI rendering and user interactions
- **Web Worker**: Heavy data processing, hex parsing, and analysis
- **Service Worker**: Offline caching and instant loading

### Technology Stack
- Vanilla JavaScript/TypeScript
- HTML5 + CSS3
- Web Workers for performance
- IndexedDB for data persistence
- Web Bluetooth API
- Service Worker for PWA capabilities

## Project Structure

```
├── index.html              # Main application entry
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/
│   └── styles.css          # Application styles
├── js/
│   ├── app.js              # Main application logic
│   ├── bluetooth-manager.js
│   ├── elm327-protocol.js
│   ├── storage-manager.js
│   ├── sample-data.js
│   └── ui/
│       ├── dashboard.js
│       ├── diagnostics.js
│       ├── history.js
│       └── settings.js
├── workers/
│   └── data-worker.js      # Web Worker for data processing
├── emulator/
│   ├── setup.sh            # Emulator setup script
│   └── start-emulator.py   # Emulator startup script
└── docs/
    └── file-format.md      # Data import format specification
```

## Setup Instructions

### Prerequisites
- Python 3.6+ (for ELM327 emulator during development)
- Modern web browser (Chrome/Edge for full Bluetooth support)
- HTTPS or localhost for Web Bluetooth API

### ELM327 Emulator Setup (Development/Testing)

1. Install the ELM327 emulator:
```bash
python3 -m pip install ELM327-emulator
```

2. Start the emulator:
```bash
cd emulator
python3 start-emulator.py
```

The emulator will start on TCP port 35000 by default, simulating a Toyota Auris Hybrid.

### Running the Application

1. Serve the application over HTTPS or localhost:
```bash
# Using Python's built-in server (localhost)
python3 -m http.server 8000
```

2. Open your browser to `http://localhost:8000`

3. For Web Bluetooth testing:
   - Use Chrome or Edge browser
   - Ensure emulator is running
   - Click "Connect Device" in the app

### Installing as PWA

1. Open the app in Chrome/Edge
2. Look for the install icon in the address bar
3. Click "Install" to add to home screen/applications
4. App will load instantly and work offline after first load

## Browser Support

| Feature | Chrome/Edge | Firefox | Safari (macOS) | Safari (iOS) |
|---------|-------------|---------|----------------|--------------|
| Web Bluetooth | ✅ | ❌ | ❌ | ❌ |
| File Upload | ✅ | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ | ✅ | ✅ |
| Offline Mode | ✅ | ✅ | ✅ | ✅ |

**Note**: iOS/Safari users must use the File Upload feature instead of direct Bluetooth connection.

## Usage Guide

### First-Time Setup

1. **Configure Vehicle Profile**
   - Go to Settings
   - Enter vehicle details (make, model, year, VIN)
   - Set initial odometer reading
   - Configure maintenance intervals

2. **Connect to ELM327**
   - **Chrome/Edge**: Click "Connect Device", select your ELM327 adapter
   - **iOS/Safari**: Use "Upload Data" to import OBD-II data files
   - Wait for "Ready" status after protocol negotiation

3. **Start Monitoring**
   - Dashboard shows live gauges updating in real-time
   - Data is automatically saved to local storage
   - View historical trends in the History tab

### Development Mode

Load sample data for testing without hardware:
1. Go to Settings → Data Management
2. Click "Load Sample Data"
3. App populates with 30 days of realistic driving data

### Data Import/Export

**Export Format (CSV)**:
```csv
timestamp,rpm,speed,coolant_temp,engine_load,fuel_level,throttle_pos
2024-01-15T10:30:00Z,2500,45,195,35,75,25
```

**Export Format (JSON)**:
```json
{
  "vehicle": {...},
  "readings": [...],
  "trips": [...],
  "maintenance": [...]
}
```

See [docs/file-format.md](docs/file-format.md) for complete specifications.

## Development

### Testing with Emulator

```bash
# Terminal 1: Start emulator
cd emulator
python3 start-emulator.py

# Terminal 2: Start web server
python3 -m http.server 8000

# Browser: http://localhost:8000
```

### Debugging

- **Web Worker**: Check `workers/data-worker.js` console via DevTools
- **Service Worker**: Application → Service Workers in DevTools
- **IndexedDB**: Application → Storage → IndexedDB in DevTools
- **Performance**: Performance tab shows 60fps rendering

## Key Features Detail

### Real-time Data Collection
- Polls 6 key PIDs every second
- 60fps gauge rendering without UI stutter
- All processing happens in Web Worker thread

### Maintenance Tracking
- Oil change intervals (time + mileage)
- Tire rotation schedules
- Annual inspections
- Air filter and brake service reminders
- 90% threshold warnings

### Fuel Efficiency Analysis
- Instantaneous MPG calculation
- Trip-based averages
- 30-day trend analysis
- Efficiency scoring and tips

### Driving Behavior Analysis
- Hard acceleration detection
- Hard braking events
- High RPM operation tracking
- Idle time monitoring
- Overall driving score (0-100)

### Data Management
- Smart pruning: 1-second intervals for current trip
- Automatic downsampling: 1-minute averages for history
- 30-day retention with aggregated summaries
- Export/import functionality

## Troubleshooting

### Web Bluetooth Issues
- **Can't find device**: Ensure ELM327 is powered and paired with OS first
- **Connection drops**: Check USB/Bluetooth adapter quality
- **iOS not working**: Use File Upload method instead

### Performance Issues
- **Slow gauges**: Check Web Worker is running (shouldn't happen)
- **High memory**: Clear old data in Settings → Data Management
- **Slow charts**: Reduce date range for large datasets

### Offline Issues
- **Won't load offline**: Visit app online first to cache assets
- **Updates not appearing**: Clear Service Worker cache and refresh

## Architecture Details

### Web Worker Communication
```javascript
// Main thread sends command
worker.postMessage({ type: 'START_POLLING', interval: 1000 });

// Worker sends parsed data
postMessage({ type: 'DATA_UPDATE', data: { rpm: 2500, speed: 45 } });
```

### IndexedDB Schema
- **vehicles**: Vehicle profiles
- **readings**: Time-series sensor data
- **trips**: Aggregated trip summaries
- **maintenanceRecords**: Service history
- **dtcHistory**: Diagnostic trouble codes

### Protocol Negotiation Flow
1. Send `ATZ` (reset)
2. Send `ATE0` (echo off)
3. Send `ATSP0` (auto protocol)
4. Send `0100` (supported PIDs)
5. Wait for valid response (not `SEARCHING...`)
6. Mark protocol as ready
7. Begin polling loop

## Contributing

This is an MVP prototype. Future enhancements could include:
- React/Vue framework migration
- Cloud sync (optional)
- Advanced analytics and ML predictions
- Multi-vehicle support
- Custom dashboard layouts
- Plugin system for custom PIDs

## License

MIT License - See LICENSE file for details

## Acknowledgments

- [ELM327-emulator](https://github.com/Ircama/ELM327-emulator) by Ircama for development/testing
- OBD-II PID specifications from SAE J1979 standard
- Web Bluetooth API documentation from MDN

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Version**: 1.0.0 (MVP)  
**Last Updated**: 2026-10-24
