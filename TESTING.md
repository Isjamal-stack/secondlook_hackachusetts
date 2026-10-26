# Testing Guide - SecondLook

## Overview

SecondLook uses **Node.js built-in test runner** (no external dependencies needed) for comprehensive testing across all layers of the application.

## Test Structure

```
tests/
├── unit/                      # Unit tests for individual modules
│   ├── services/             # Service layer tests
│   │   ├── logger.test.mjs
│   │   ├── error-handler.test.mjs
│   │   ├── bluetooth-manager.test.mjs
│   │   ├── storage-manager.test.mjs
│   │   └── elm327-protocol.test.mjs
│   ├── ui/                   # UI component tests
│   │   └── chart-manager.test.mjs
│   └── demo/                 # Demo system tests
│       └── demo-controller.test.mjs
│
├── integration/              # Integration tests
│   ├── bluetooth-flow.test.mjs
│   ├── storage-flow.test.mjs
│   └── demo-flow.test.mjs
│
├── e2e/                      # End-to-end tests
│   └── full-app.test.mjs
│
├── helpers/                  # Test utilities
│   ├── mock-bluetooth.mjs
│   ├── mock-storage.mjs
│   └── test-utils.mjs
│
├── part-a.test.mjs          # Existing hackathon tests (preserved)
├── presentation.test.mjs    # Existing presentation tests (preserved)
└── ui-demo.test.mjs         # Existing UI tests (preserved)
```

## Prerequisites

**Node.js 18+** is required for the built-in test runner.

### Installing Node.js on macOS
```bash
# Using Homebrew (recommended)
brew install node

# Verify installation
node --version  # Should show v18.0.0 or higher
```

See [tests/README.md](tests/README.md) for detailed setup instructions.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
node --test tests/unit/services/logger.test.mjs
```

### Run Tests with Coverage
```bash
node --test --experimental-test-coverage tests/**/*.test.mjs
```

### Run Tests in Watch Mode (Node 20+)
```bash
node --test --watch tests/**/*.test.mjs
```

### Run Only Unit Tests
```bash
npm run test:unit
```

### Run Only Integration Tests
```bash
npm run test:integration
```

### Run Only E2E Tests
```bash
npm run test:e2e
```

## Testing Strategy

### Unit Tests (tests/unit/)

**Purpose**: Test individual modules in isolation

**What to test**:
- Individual functions
- Class methods
- Edge cases and error conditions
- Input validation
- Return values

**Example**:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { logger } from '../js/utils/logger.js';

test('logger - logs message with correct level', () => {
  const messages = [];
  logger.configure({ onLog: (msg) => messages.push(msg) });
  
  logger.info('Test message');
  
  assert.equal(messages.length, 1);
  assert.equal(messages[0].level, 'INFO');
  assert.equal(messages[0].message, 'Test message');
});
```

### Integration Tests (tests/integration/)

**Purpose**: Test multiple modules working together

**What to test**:
- Service interactions
- Data flow between layers
- Error propagation
- State management

**Example**:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { BluetoothManager } from '../js/services/bluetooth-manager.js';
import { ELM327Protocol } from '../js/services/elm327-protocol.js';

test('Bluetooth + Protocol - full command flow', async () => {
  const bluetooth = new BluetoothManager();
  const protocol = new ELM327Protocol();
  
  const response = await bluetooth.simulateResponse('0105');
  const parsed = protocol.parsePIDResponse(response, '05');
  
  assert.equal(parsed, 90); // Coolant temp
});
```

### E2E Tests (tests/e2e/)

**Purpose**: Test complete user workflows

**What to test**:
- Full user scenarios
- Demo mode workflows
- Real Bluetooth connection flow (with emulator)
- Data persistence and retrieval

**Example**:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

test('E2E - Demo mode full workflow', async () => {
  // 1. Start demo mode
  // 2. Select scenario
  // 3. Collect data
  // 4. Verify visualization
  // 5. Save session
  // 6. Verify storage
});
```

## Test Helpers

### Mock Bluetooth Device
```javascript
// tests/helpers/mock-bluetooth.mjs
export function createMockBluetoothDevice() {
  return {
    name: 'Mock ELM327',
    gatt: {
      connect: async () => ({ /* mock GATT */ }),
      disconnect: () => {}
    }
  };
}
```

### Mock Storage
```javascript
// tests/helpers/mock-storage.mjs
export function createMockStorage() {
  const store = new Map();
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
    clear: () => store.clear()
  };
}
```

### Test Utilities
```javascript
// tests/helpers/test-utils.mjs
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestContext() {
  // Create isolated test environment
}
```

## Testing Best Practices

### 1. Test Organization
- **One test file per source file** (unit tests)
- **Descriptive test names** that explain what is being tested
- **Group related tests** using `test.describe()` (Node 20+)

### 2. Test Independence
- Each test should be independent
- Use setup/teardown for shared state
- Don't rely on test execution order

### 3. Assertions
- Use `assert.strictEqual()` instead of `assert.equal()`
- Test both success and failure cases
- Test edge cases and boundaries

### 4. Mocking
- Mock external dependencies (Bluetooth, IndexedDB)
- Don't mock the code under test
- Use minimal mocks - only what's needed

### 5. Coverage
- Aim for 80%+ coverage on critical paths
- 100% coverage on utils and services
- Focus on meaningful tests, not just coverage numbers

## What to Test

### High Priority (Must Test)

#### Services Layer
- ✅ **Logger** - All log levels, dev/prod mode, log export
- ✅ **Error Handler** - Error categorization, recovery, messages
- ✅ **Bluetooth Manager** - Connection, disconnection, data transmission
- ✅ **Storage Manager** - CRUD operations, session management, export/import
- ✅ **ELM327 Protocol** - Command formatting, response parsing, PID handling

#### UI Layer
- ✅ **Chart Manager** - Chart creation, updates, data visualization

#### Demo System
- ✅ **Demo Controller** - Scenario management, data generation
- ✅ **Demo Data Generator** - Realistic data, variations
- ✅ **Demo Scenarios** - All pre-built scenarios

### Medium Priority (Should Test)

#### Integration Flows
- Bluetooth → Protocol → Storage flow
- Demo mode end-to-end
- Error handling across layers
- State management

### Lower Priority (Nice to Have)

#### E2E Scenarios
- Full user workflows with emulator
- Data export/import
- Offline functionality
- Service worker caching

## Test Data

### Sample OBD-II Responses
```javascript
export const MOCK_RESPONSES = {
  // RPM
  '010C': '41 0C 1F 40',  // ~2000 RPM
  
  // Speed
  '010D': '41 0D 2D',     // 45 km/h
  
  // Coolant temp
  '0105': '41 05 B7',     // 90°C
  
  // Engine load
  '0104': '41 04 64',     // 39%
  
  // Throttle position
  '0111': '41 11 32',     // 20%
};
```

### Sample Sessions
```javascript
export const MOCK_SESSION = {
  sessionId: 'test-session-001',
  startTime: Date.now(),
  endTime: Date.now() + 300000, // 5 minutes
  readings: [
    { timestamp: Date.now(), rpm: 2000, speed: 45, coolant: 90 }
  ]
};
```

## Coverage Goals

### Current Coverage
- **Existing tests**: Part A, Presentation, UI Demo (working)
- **New tests**: To be added (Phase 6)

### Target Coverage (by layer)

| Layer | Current | Target | Priority |
|-------|---------|--------|----------|
| **Utils** | 0% | 90%+ | High |
| **Services** | ~20% | 80%+ | High |
| **UI** | ~30% | 70%+ | Medium |
| **Demo** | 40% | 80%+ | Medium |
| **Integration** | 0% | 60%+ | Medium |
| **E2E** | 0% | 50%+ | Low |

## Continuous Integration

### GitHub Actions Workflow (Future)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm test
      - run: npm run test:coverage
```

## Debugging Tests

### Run Single Test with Debug Output
```bash
node --test --test-reporter=spec tests/unit/services/logger.test.mjs
```

### Use Node.js Debugger
```bash
node --inspect-brk --test tests/unit/services/logger.test.mjs
```

### Add Debug Logging
```javascript
import { logger } from '../js/utils/logger.js';

test('my test', () => {
  logger.setLevel('DEBUG');
  // ... test code with debug output
});
```

## Common Testing Patterns

### Testing Async Functions
```javascript
test('async operation completes', async () => {
  const result = await someAsyncFunction();
  assert.equal(result, 'expected');
});
```

### Testing Errors
```javascript
test('throws on invalid input', () => {
  assert.throws(
    () => functionThatThrows(),
    /Expected error message/
  );
});

test('async function rejects', async () => {
  await assert.rejects(
    async () => await asyncFunctionThatRejects(),
    /Expected error message/
  );
});
```

### Testing Events
```javascript
test('emits event on completion', (t, done) => {
  const emitter = new EventEmitter();
  
  emitter.on('complete', (data) => {
    assert.equal(data, 'expected');
    done();
  });
  
  emitter.emit('complete', 'expected');
});
```

### Testing with Timeouts
```javascript
test('completes within timeout', { timeout: 5000 }, async () => {
  await longRunningOperation();
});
```

## Troubleshooting

### Tests Hang
- Check for missing `await` on async operations
- Look for unclosed promises
- Verify all timers are cleared

### Intermittent Failures
- Tests may have race conditions
- Add proper `await` for async operations
- Ensure test independence

### Import Errors
- Use `.mjs` extension for ES modules
- Check file paths are correct
- Verify exports are named correctly

## Next Steps

### Phase 6 Roadmap

1. **Week 1**: Unit tests for utils and services
   - Logger tests
   - Error handler tests
   - Service layer tests

2. **Week 2**: Integration tests
   - Bluetooth flow tests
   - Storage flow tests
   - Demo flow tests

3. **Week 3**: E2E tests and polish
   - Full workflow tests
   - Coverage analysis
   - CI/CD setup

## Resources

- [Node.js Test Runner Docs](https://nodejs.org/api/test.html)
- [Node.js Assert Docs](https://nodejs.org/api/assert.html)
- [Web Bluetooth Testing](https://developer.chrome.com/articles/bluetooth/)
- [IndexedDB Testing Patterns](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**Last Updated**: October 24, 2026
**Status**: Phase 6 - Testing Infrastructure Setup
**Coverage Goal**: 70%+ across critical paths
