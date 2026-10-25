# Utils Directory

This directory contains utility modules and helper functions that are used across the application.

## Files

### `logger.js`
**Purpose**: Centralized logging system with multiple log levels

**Features**:
- Multiple log levels: DEBUG, INFO, WARN, ERROR
- Automatic dev/production mode detection
- Timestamps on all log entries
- Persistent log storage (optional)
- Exportable logs for troubleshooting
- Production-safe (no debug spam)

**Log Levels**:
- `DEBUG` - Detailed information for debugging (dev only)
- `INFO` - General informational messages
- `WARN` - Warning messages (always shown)
- `ERROR` - Error messages (always shown)

**Key Methods**:
- `logger.debug(context, message, ...args)` - Debug logging
- `logger.info(context, message, ...args)` - Info logging
- `logger.warn(context, message, ...args)` - Warning logging
- `logger.error(context, message, ...args)` - Error logging
- `logger.setLevel(level)` - Change log level
- `logger.exportLogs()` - Export logs as JSON

**Configuration**:
- Auto-detects development mode (localhost)
- Shows DEBUG/INFO in development
- Shows only WARN/ERROR in production

---

### `error-handler.js`
**Purpose**: Centralized error handling with user-friendly messages

**Features**:
- Categorized error types
- User-friendly error messages
- Integration with logger
- Error recovery suggestions
- Consistent error handling pattern

**Error Categories**:
- `bluetooth` - Bluetooth connection errors
- `storage` - IndexedDB and data storage errors
- `network` - Network and API errors
- `protocol` - ELM327/OBD-II protocol errors
- `validation` - Data validation errors

**Key Functions**:
- `errorHandler.handle(error, category)` - Handle and log error
- `errorHandler.getUserMessage(error, category)` - Get user-friendly message
- `errorHandler.isRecoverable(error)` - Check if error is recoverable

**Error Types Export**:
```javascript
export const ErrorTypes = {
    BLUETOOTH: 'bluetooth',
    STORAGE: 'storage',
    NETWORK: 'network',
    PROTOCOL: 'protocol',
    VALIDATION: 'validation'
};
```

---

## Usage Examples

### Logger
```javascript
import { logger } from './utils/logger.js';

// Debug information (dev only)
logger.debug('Bluetooth', 'Connecting to device...', { deviceId: '123' });

// General info
logger.info('Storage', 'Data saved successfully');

// Warnings (always shown)
logger.warn('Protocol', 'PID not supported:', '0xFF');

// Errors (always shown)
logger.error('Bluetooth', 'Connection failed:', error);

// Change log level
logger.setLevel('WARN'); // Only show warnings and errors

// Export logs
const logs = logger.exportLogs();
console.log(JSON.stringify(logs, null, 2));
```

### Error Handler
```javascript
import errorHandler, { ErrorTypes } from './utils/error-handler.js';

try {
    await bluetooth.connect();
} catch (error) {
    // Handle and log error
    errorHandler.handle(error, ErrorTypes.BLUETOOTH);
    
    // Get user-friendly message
    const message = errorHandler.getUserMessage(error, ErrorTypes.BLUETOOTH);
    showToast(message, 'error');
    
    // Check if recoverable
    if (errorHandler.isRecoverable(error)) {
        // Attempt recovery
        setTimeout(() => retry(), 5000);
    }
}
```

---

## Design Patterns

### Singleton Pattern (Logger)
Logger is implemented as a singleton:
- Single instance across the app
- Centralized configuration
- Consistent logging format

### Strategy Pattern (Error Handler)
Error handling strategy varies by error type:
- Different messages per category
- Category-specific recovery logic
- Extensible for new error types

### Facade Pattern
Utils provide simple interfaces to complex operations:
- Hide implementation details
- Easy to use APIs
- Consistent behavior

---

## Best Practices

### Logging Best Practices

**DO**:
- Use appropriate log levels
- Include context (module name)
- Log important state changes
- Log errors with stack traces
- Use DEBUG for verbose output

**DON'T**:
- Log sensitive data (passwords, tokens)
- Log in tight loops (performance)
- Use console.log directly
- Log too verbosely in production

### Example
```javascript
// Good
logger.info('Bluetooth', 'Connected to device', { deviceName });

// Bad
console.log('Connected to ' + deviceName); // Use logger instead
logger.debug('Loop', 'Iteration ' + i); // Don't log in loops
logger.info('User', 'Password:', password); // Never log sensitive data
```

### Error Handling Best Practices

**DO**:
- Always categorize errors
- Provide user-friendly messages
- Log full error details
- Include recovery suggestions
- Handle errors at appropriate level

**DON'T**:
- Swallow errors silently
- Show technical errors to users
- Use generic error messages
- Catch errors too broadly

### Example
```javascript
// Good
try {
    await storage.saveData(data);
} catch (error) {
    errorHandler.handle(error, ErrorTypes.STORAGE);
    showToast('Failed to save data. Please try again.', 'error');
}

// Bad
try {
    await storage.saveData(data);
} catch (error) {
    // Silent failure
}

// Bad
try {
    await storage.saveData(data);
} catch (error) {
    alert(error.message); // Technical message to user
}
```

---

## Future Utility Modules

### Planned Additions
- [ ] **validators.js** - Data validation helpers
- [ ] **formatters.js** - Data formatting (dates, numbers, units)
- [ ] **constants.js** - Application constants
- [ ] **helpers.js** - General helper functions
- [ ] **api-client.js** - API request wrapper
- [ ] **storage-helpers.js** - LocalStorage/SessionStorage helpers
- [ ] **dom-utils.js** - DOM manipulation helpers
- [ ] **date-utils.js** - Date/time utilities

### Validator Example
```javascript
// Future: validators.js
export const validators = {
    isValidVIN: (vin) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin),
    isValidRPM: (rpm) => rpm >= 0 && rpm <= 8000,
    isValidSpeed: (speed) => speed >= 0 && speed <= 200,
    isValidTemp: (temp) => temp >= -40 && temp <= 200
};
```

### Formatters Example
```javascript
// Future: formatters.js
export const formatters = {
    formatDate: (date) => new Date(date).toLocaleDateString(),
    formatNumber: (num, decimals = 1) => num.toFixed(decimals),
    formatSpeed: (kph) => `${kph.toFixed(0)} km/h`,
    formatTemp: (celsius) => `${celsius.toFixed(1)}°C`
};
```

---

## Guidelines for New Utilities

When adding new utility modules:

1. **Pure Functions**: Utilities should be pure (no side effects)
2. **Reusable**: Design for use across multiple features
3. **Well-Tested**: Add unit tests for all utilities
4. **Documented**: Include JSDoc comments
5. **Small**: Keep utilities focused and small
6. **Exported**: Use named exports for tree-shaking

### Template
```javascript
/**
 * Utility description
 * @module utils/my-util
 */

/**
 * Function description
 * @param {type} param - Parameter description
 * @returns {type} Return description
 * @example
 * myFunction(input);
 */
export function myFunction(param) {
    // Implementation
    return result;
}
```

---

## Testing Utilities

### Unit Testing
```javascript
// logger.test.js
import { logger } from './logger.js';

describe('Logger', () => {
    test('logs debug messages in dev mode', () => {
        logger.debug('Test', 'Debug message');
        // Assert log output
    });
    
    test('filters debug in production', () => {
        logger.setLevel('WARN');
        logger.debug('Test', 'Should not appear');
        // Assert no output
    });
});
```

### Error Handler Testing
```javascript
// error-handler.test.js
import errorHandler, { ErrorTypes } from './error-handler.js';

describe('Error Handler', () => {
    test('categorizes Bluetooth errors', () => {
        const error = new Error('Connection failed');
        const message = errorHandler.getUserMessage(error, ErrorTypes.BLUETOOTH);
        expect(message).toContain('Bluetooth');
    });
});
```

---

**Last Updated**: October 24, 2026  
**Maintainer**: SecondLook Team
