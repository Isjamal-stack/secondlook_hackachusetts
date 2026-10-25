# Code Cleanup Checklist for SecondLook

## Phase 1: Logging System ✅
- [x] Create centralized logger (`js/logger.js`)
- [x] Create error handler (`js/error-handler.js`)
- [ ] Replace all `console.log` with `logger.debug/info`
- [ ] Replace all `console.warn` with `logger.warn`
- [ ] Replace all `console.error` with `logger.error` or `errorHandler.handle`
- [ ] Add logger imports to all files

## Phase 2: Remove Debug/Hackathon Code
- [ ] Remove or move demo/simulation code to separate directory
- [ ] Remove `DEMO_INTEGRATION.md`, `PROJECT_BRIEF.md` (archive them)
- [ ] Remove `PART_A_HANDOFF.md`, `STARTUP.md` (archive them)
- [ ] Clean up test data generators
- [ ] Remove demo-specific UI elements

## Phase 3: Error Handling Standardization
- [ ] Add try-catch blocks where missing
- [ ] Use errorHandler for consistent error messages
- [ ] Add input validation for all user inputs
- [ ] Add proper error recovery mechanisms

## Phase 4: Code Organization
- [ ] Break large files into smaller modules
- [ ] Create a `utils/` directory for shared utilities
- [ ] Move constants to `constants.js`
- [ ] Create proper folder structure:
  ```
  js/
    ├── core/           # Core application logic
    ├── services/       # Bluetooth, Storage, etc.
    ├── utils/          # Utilities and helpers
    ├── ui/             # UI components
    └── demo/           # Demo-specific code (optional)
  ```

## Phase 5: Documentation
- [ ] Add JSDoc comments to all public functions
- [ ] Document function parameters and return values
- [ ] Add file-level documentation
- [ ] Create inline comments for complex logic only

## Phase 6: Dead Code Removal
- [ ] Remove unused functions
- [ ] Remove commented-out code
- [ ] Remove unused imports
- [ ] Remove duplicate code

## Phase 7: Code Style Consistency
- [ ] Consistent naming conventions (camelCase for functions/variables)
- [ ] Consistent async/await vs promises
- [ ] Consistent string quotes (single vs double)
- [ ] Add proper spacing and indentation
- [ ] Remove trailing whitespace

## Phase 8: Performance & Best Practices
- [ ] Remove magic numbers (use named constants)
- [ ] Add proper loading states
- [ ] Debounce user input handlers
- [ ] Use event delegation where appropriate
- [ ] Add proper cleanup in destructors

## Phase 9: Security & Validation
- [ ] Sanitize user inputs
- [ ] Validate data from external sources (Bluetooth, file uploads)
- [ ] Add CSP headers
- [ ] Remove any hardcoded secrets/keys
- [ ] Add rate limiting for AI API calls

## Phase 10: Testing Setup
- [ ] Set up testing framework (Jest)
- [ ] Write unit tests for critical functions
- [ ] Add integration tests
- [ ] Set up CI/CD pipeline

---

## Files to Clean (Priority Order)

### High Priority
1. `js/app.js` - Main entry point (900+ lines)
2. `js/bluetooth-manager.js` - Bluetooth connectivity
3. `js/storage-manager.js` - Data persistence
4. `js/elm327-protocol.js` - Protocol handler
5. `server/server.py` - Backend server
6. `server/ai_provider.py` - AI integration

### Medium Priority
7. `workers/data-worker.js` - Web worker
8. `js/chart-manager.js` - Charting
9. `js/sample-data.js` - Sample data generation
10. `sw.js` - Service worker

### Low Priority (Demo-specific)
11. `js/demo-presentation.js`
12. `js/demo-examples.js`
13. `js/simulation.js`
14. `js/insight-engine.js`

---

## Estimated Time
- Phase 1-3: 2-3 hours
- Phase 4-6: 3-4 hours
- Phase 7-9: 2-3 hours
- Phase 10: 4-6 hours (if adding comprehensive tests)

**Total: 11-16 hours of focused work**

---

## Next Steps
1. Start with Phase 1 (Logging System) ✅
2. Update app.js with new logger
3. Update other high-priority files
4. Run the app and test all features
5. Move to Phase 2 (Demo code cleanup)
