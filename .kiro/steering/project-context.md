---
inclusion: auto
name: SecondLook Project Context
description: Information about the SecondLook vehicle diagnostics PWA architecture and development setup
---

# SecondLook Project Context

## Project Overview
SecondLook is a Progressive Web App (PWA) for OBD-II vehicle diagnostics using ELM327 adapters. Built for the Hackachusetts hackathon, it provides real-time vehicle monitoring with AI-powered insights.

## Architecture

### Frontend (PWA)
- **Technology**: Vanilla JavaScript ES6 modules, no framework
- **Entry Point**: `index.html` → `js/app.js`
- **Key Modules**:
  - `js/simulation.js` - Demo scenarios with 11 OBD-II parameters
  - `js/insight-engine.js` - Analysis engine for detecting vehicle conditions
  - `js/bluetooth-manager.js` - ELM327 Bluetooth connectivity
  - `js/storage-manager.js` - IndexedDB for local data persistence

### Backend (Flask Server)
- **Location**: `server/`
- **Port**: 3000
- **Key Files**:
  - `server/server.py` - Flask app serving both frontend and API
  - `server/ai_provider.py` - OpenAI integration for AI insights
  - `server/template_explanations.py` - Fallback explanations
- **Environment**: Configuration in `server/.env` (not committed)

### OBD-II Parameters Tracked
1. Engine RPM (`rpm`)
2. Vehicle Speed (`speed_kmh`)
3. Coolant Temperature (`coolant_c`)
4. Engine Load (`engine_load_pct`)
5. Intake Air Temperature (`intake_air_temp_c`)
6. Battery Voltage (`battery_voltage`)
7. Short Term Fuel Trim (`fuel_trim_short_pct`)
8. Long Term Fuel Trim (`fuel_trim_long_pct`)
9. Mass Air Flow (`maf_gps`)
10. O2 Sensor Voltage (`o2_sensor_v`)
11. Throttle Position (`throttle_pos_pct`)

## Development Workflow

### Running the Server
```bash
cd server
python3 server.py
# Server runs on http://localhost:3000
```

### Demo Mode
Access the demo at: `http://localhost:3000/?demo=1`
- Two scenarios: `normal-warmup` and `temperature-rise`
- 45-second compressed time simulations
- No vehicle connection needed

### AI Configuration
Edit `server/.env`:
- `AI_PROVIDER=openai` (or `none` for template mode)
- `OPENAI_API_KEY=sk-proj-...`
- `OPENAI_MODEL=gpt-4o-mini`

### Branch Strategy
- `main` - Stable releases
- `test` - Integration and testing (current development branch)
- Merge to `main` when features are complete

## Code Style
- Use ES6+ JavaScript features (modules, arrow functions, async/await)
- Prefer `const` over `let`, avoid `var`
- Functions should be small and focused
- Comments explain "why", not "what"
- No external dependencies in frontend (vanilla JS only)

## Testing
- Manual testing via demo mode
- No automated test suite currently
- Test both scenarios before committing

## Common Tasks

### Adding New OBD-II Parameters
1. Update `readingAt()` in `js/simulation.js`
2. Add validation in `js/insight-engine.js`
3. Update server validation in `server/server.py`
4. Add metric card in `index.html`
5. Update `renderReading()` in `js/app.js`

### Modifying AI Insights
1. Edit system prompt in `server/ai_provider.py`
2. Test with `python3 test_ai.py` (if test script exists)
3. Restart server to reload changes
4. Clear server cache (restart) to see new responses

### Cache Management
- Server caches AI responses for 60 seconds
- Restart server to clear cache during development
- Browser caching: Use Cmd+Shift+R for hard refresh
