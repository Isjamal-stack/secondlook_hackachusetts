# SecondLook Demo System

This directory contains the demo/simulation system for SecondLook, which provides a realistic vehicle diagnostics experience without requiring actual OBD-II hardware.

## Purpose

The demo system serves multiple purposes:
- **Development**: Test features without physical hardware
- **Demonstrations**: Showcase the app at hackathons and presentations
- **User Onboarding**: Help users understand the app before connecting real vehicles
- **Testing**: Provide deterministic scenarios for automated testing

## How to Use

### Activate Demo Mode

Add `?demo=1` to the URL:
```
http://localhost:3000/?demo=1
```

The app will automatically switch to simulation mode and display demo controls on the dashboard.

### Available Scenarios

The demo system includes several predefined scenarios:

1. **Normal Warmup** - Vehicle warming from 40°C to stable 90°C
2. **Temperature Rise** - Simulated coolant temperature rise event
3. **Mixed Driving** - Combination of city and highway driving
4. **City Driving** - Stop-and-go urban traffic patterns
5. **Highway Driving** - Sustained high-speed driving

## Architecture

### Files Overview

#### Core Simulation Files
- **`simulation.js`** - Time-compressed deterministic demo scenarios
  - Defines SCENARIOS with temperature profiles
  - Generates OBD-II readings in real-time
  - Includes 11 parameters (RPM, speed, coolant temp, etc.)

- **`insight-engine.js`** - Prototype rules for scenario analysis
  - Validates readings
  - Detects conditions (temperature rise, normal warmup)
  - Provides approval for next steps

- **`demo-examples.js`** - Fixed playback UI fixtures
  - Temporary preview mode
  - Pre-recorded scenario data

#### Presentation & UI
- **`demo-presentation.js`** - UI formatting and explanations
  - GLOSSARY: Term definitions (coolant, RPM, etc.)
  - Finding status display
  - Rule descriptions
  - Trip summaries

- **`simulation-adapter.js`** - Integration adapter
  - Connects simulation to main UI
  - Bridges demo system with app.js

#### Data Generation
- **`sample-data.js`** - Historical data generator
  - Generates 30 days of realistic trip data
  - Creates maintenance records
  - Simulates DTC (diagnostic trouble code) history
  - Used for "Load Sample Data" feature in Settings

## Integration with Main App

The demo system integrates with `app.js` through several functions:

```javascript
// In app.js
import { createSimulation } from './demo/simulation.js';
import { GLOSSARY, findingStatus, ... } from './demo/demo-presentation.js';

// Initialize demo on page load
initializeDemo();
configureDemo({ createSimulation });
```

### Demo Controller Functions

Main demo control functions in app.js:
- `initializeDemo()` - Set up event listeners and chart
- `startDemo()` - Begin scenario playback
- `pauseDemo()` - Pause the simulation
- `resetDemo()` - Reset state and UI
- `renderReading()` - Update UI with new reading
- `renderAnalysis()` - Display AI-generated insights

## Data Flow

```
User clicks "Start"
    ↓
startDemo() creates simulation controller
    ↓
simulation.js generates readings every second
    ↓
onReading() → renderReading() updates dashboard
    ↓
insight-engine.js analyzes for conditions
    ↓
onAnalysis() → renderAnalysis() shows findings
    ↓
onComplete() → completeDemo() displays summary
```

## Demo vs. Production Code

### Demo-Only Code
- All files in this directory (`js/demo/`)
- Demo functions in `app.js` (marked with comments)
- `simulateResponse()` method in `bluetooth-manager.js`

### Shared Code
- Logger and error handling
- Storage manager (used for sample data)
- Chart manager (displays demo data)
- UI components (render both demo and real data)

## Development Guidelines

### Adding New Scenarios

1. Edit `simulation.js` and add to `SCENARIOS`:
```javascript
'new-scenario': Object.freeze({
    duration_s: 60,
    description: 'Description of scenario'
})
```

2. Add scenario logic in `readingAtSecond()` function

3. Update `index.html` to add scenario to dropdown (if exposing to UI)

### Modifying Demo UI

Demo UI elements are in `index.html` and controlled by functions in `app.js`:
- Scenario selector: `#demo-scenario`
- Control buttons: `#demo-start`, `#demo-pause`, `#demo-reset`
- Status display: `#demo-status`
- Chart: `#coolant-trend`

### Sample Data Generation

To modify the sample data generator:
1. Edit `sample-data.js`
2. Adjust scenarios, trip parameters, or data ranges
3. Data is generated when user clicks "Load Sample Data" in Settings

## Testing Demo Mode

### Manual Testing Checklist
- [ ] Demo mode activates with `?demo=1`
- [ ] Scenario selector shows all options
- [ ] Start/Pause/Reset buttons work
- [ ] Readings update in real-time
- [ ] Chart displays temperature trends
- [ ] AI insights generate correctly
- [ ] "Load Sample Data" populates history

### Automated Testing (Future)
Consider adding Jest tests for:
- Scenario generation logic
- Reading validation
- Condition detection
- UI state management

## Performance Considerations

### Optimization Tips
- Readings generated synchronously (1 per second)
- Chart updates use 'none' animation mode for performance
- Data buffer limited to prevent memory issues
- Demo runs in main thread (consider Web Worker for complex scenarios)

## Future Enhancements

### Potential Improvements
1. **More Scenarios**: Add DTC detection, fuel economy, aggressive driving
2. **Configurable Parameters**: Let users adjust scenario settings
3. **Scenario Editor**: UI for creating custom scenarios
4. **Recording/Playback**: Record real OBD-II data, replay as demo
5. **Shared Scenarios**: Export/import scenario files
6. **Web Worker**: Move simulation to worker for better performance

## Troubleshooting

### Demo Not Starting
- Check browser console for errors
- Verify all demo files are loaded
- Ensure `?demo=1` is in URL
- Check that `createSimulation` is properly imported

### Chart Not Displaying
- Verify Chart.js is loaded (CDN)
- Check for JavaScript errors
- Ensure canvas element exists: `#coolant-trend`

### Readings Not Updating
- Check `onReading` callback is connected
- Verify simulation timer is running
- Look for errors in `simulation.js`

## Removing Demo Code (Production Builds)

If you want to remove demo code for production:

1. Delete the `/js/demo/` directory
2. Remove demo imports from `app.js`
3. Remove demo initialization calls
4. Remove demo UI elements from `index.html`
5. Remove demo assets from `sw.js` cache

Consider using a build tool (Webpack, Vite) to conditionally include demo code.

---

**Last Updated**: October 24, 2026  
**Maintainer**: SecondLook Team  
**Related Docs**: `/docs/file-format.md`, `/DEVELOPMENT.md`
