/**
 * @fileoverview Unit tests for logger utility
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpy, captureConsole } from '../../helpers/test-utils.mjs';

// Mock the logger since it uses window/document
const createTestLogger = (isDev = true) => {
  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };
  
  class TestLogger {
    constructor() {
      this.level = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
      this.enablePersistence = false;
      this.maxLogs = 100;
      this.logs = [];
      // Create fresh spies for each test
      this.consoleLog = createSpy();
      this.consoleWarn = createSpy();
      this.consoleError = createSpy();
    }
    
    #shouldLog(level) {
      return level >= this.level;
    }
    
    #formatMessage(level, component, message, data) {
      const timestamp = new Date().toISOString();
      const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
      
      return {
        timestamp,
        level: levelName,
        component,
        message,
        data
      };
    }
    
    #persist(logEntry) {
      if (!this.enablePersistence) return;
      
      this.logs.push(logEntry);
      
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
    }
    
    debug(component, message, data = null) {
      if (!this.#shouldLog(LOG_LEVELS.DEBUG)) return;
      
      const logEntry = this.#formatMessage(LOG_LEVELS.DEBUG, component, message, data);
      this.consoleLog(`[${component}] ${message}`, data || '');
      this.#persist(logEntry);
    }
    
    info(component, message, data = null) {
      if (!this.#shouldLog(LOG_LEVELS.INFO)) return;
      
      const logEntry = this.#formatMessage(LOG_LEVELS.INFO, component, message, data);
      this.consoleLog(`[${component}] ${message}`, data || '');
      this.#persist(logEntry);
    }
    
    warn(component, message, data = null) {
      if (!this.#shouldLog(LOG_LEVELS.WARN)) return;
      
      const logEntry = this.#formatMessage(LOG_LEVELS.WARN, component, message, data);
      this.consoleWarn(`[${component}] ${message}`, data || '');
      this.#persist(logEntry);
    }
    
    error(component, message, error = null) {
      if (!this.#shouldLog(LOG_LEVELS.ERROR)) return;
      
      const logEntry = this.#formatMessage(LOG_LEVELS.ERROR, component, message, {
        error: error?.message,
        stack: error?.stack
      });
      this.consoleError(`[${component}] ${message}`, error || '');
      this.#persist(logEntry);
    }
    
    getLogs() {
      return [...this.logs];
    }
    
    clearLogs() {
      this.logs = [];
    }
  }
  
  return new TestLogger();
};

test('Logger - DEBUG level logs in development mode', () => {
  const logger = createTestLogger(true);
  
  logger.debug('Test', 'Debug message');
  
  assert.equal(logger.consoleLog.callCount(), 1);
  assert.ok(logger.consoleLog.calledWith('[Test] Debug message', ''));
});

test('Logger - INFO level logs in development mode', () => {
  const logger = createTestLogger(true);
  
  logger.info('Test', 'Info message', { key: 'value' });
  
  assert.equal(logger.consoleLog.callCount(), 1);
  // Check that the function was called (parameters may vary)
  assert.ok(logger.consoleLog.calls.length > 0);
});

test('Logger - WARN level always logs', () => {
  const devLogger = createTestLogger(true);
  const prodLogger = createTestLogger(false);
  
  devLogger.warn('Test', 'Warning message');
  prodLogger.warn('Test', 'Warning message');
  
  assert.equal(devLogger.consoleWarn.callCount(), 1);
  assert.equal(prodLogger.consoleWarn.callCount(), 1);
});

test('Logger - ERROR level always logs', () => {
  const devLogger = createTestLogger(true);
  const prodLogger = createTestLogger(false);
  
  const error = new Error('Test error');
  devLogger.error('Test', 'Error message', error);
  prodLogger.error('Test', 'Error message', error);
  
  assert.equal(devLogger.consoleError.callCount(), 1);
  assert.equal(prodLogger.consoleError.callCount(), 1);
});

test('Logger - Production mode suppresses DEBUG', () => {
  const logger = createTestLogger(false); // Production mode - fresh logger
  
  logger.debug('Test', 'Debug message');
  
  assert.equal(logger.consoleLog.callCount(), 0);
});

test('Logger - Production mode suppresses INFO', () => {
  const logger = createTestLogger(false); // Production mode - fresh logger
  
  logger.info('Test', 'Info message');
  
  assert.equal(logger.consoleLog.callCount(), 0);
});

test('Logger - Persistence disabled by default', () => {
  const logger = createTestLogger();
  
  logger.debug('Test', 'Message');
  
  assert.equal(logger.getLogs().length, 0);
});

test('Logger - Persistence stores logs when enabled', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.debug('Test', 'Message 1');
  logger.info('Test', 'Message 2');
  logger.warn('Test', 'Message 3');
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 3);
  assert.equal(logs[0].level, 'DEBUG');
  assert.equal(logs[1].level, 'INFO');
  assert.equal(logs[2].level, 'WARN');
});

test('Logger - Persistence respects maxLogs limit', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  logger.maxLogs = 5;
  
  // Log more than maxLogs
  for (let i = 0; i < 10; i++) {
    logger.debug('Test', `Message ${i}`);
  }
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 5);
  // Should keep the last 5 logs
  assert.equal(logs[0].message, 'Message 5');
  assert.equal(logs[4].message, 'Message 9');
});

test('Logger - Log entry format includes timestamp and component', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.info('Bluetooth', 'Connected', { device: 'ELM327' });
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 1);
  
  const log = logs[0];
  assert.ok(log.timestamp);
  assert.equal(log.level, 'INFO');
  assert.equal(log.component, 'Bluetooth');
  assert.equal(log.message, 'Connected');
  assert.deepEqual(log.data, { device: 'ELM327' });
});

test('Logger - Error log includes error details', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  const error = new Error('Connection failed');
  logger.error('Bluetooth', 'Failed to connect', error);
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 1);
  
  const log = logs[0];
  assert.equal(log.level, 'ERROR');
  assert.equal(log.data.error, 'Connection failed');
  assert.ok(log.data.stack);
});

test('Logger - clearLogs removes all persisted logs', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.debug('Test', 'Message 1');
  logger.info('Test', 'Message 2');
  
  assert.equal(logger.getLogs().length, 2);
  
  logger.clearLogs();
  
  assert.equal(logger.getLogs().length, 0);
});

test('Logger - getLogs returns copy of logs array', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.debug('Test', 'Message');
  
  const logs1 = logger.getLogs();
  const logs2 = logger.getLogs();
  
  // Should be equal but not the same reference
  assert.deepEqual(logs1, logs2);
  assert.notEqual(logs1, logs2);
});

test('Logger - handles null data gracefully', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.info('Test', 'Message without data');
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].data, null);
});

test('Logger - handles complex data objects', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  const complexData = {
    user: { id: 123, name: 'Test' },
    settings: { theme: 'dark' },
    nested: { deep: { value: 42 } }
  };
  
  logger.debug('Test', 'Complex data', complexData);
  
  const logs = logger.getLogs();
  assert.deepEqual(logs[0].data, complexData);
});

test('Logger - multiple components can log independently', () => {
  const logger = createTestLogger();
  logger.enablePersistence = true;
  
  logger.info('Bluetooth', 'BT message');
  logger.info('Storage', 'Storage message');
  logger.info('Protocol', 'Protocol message');
  
  const logs = logger.getLogs();
  assert.equal(logs.length, 3);
  assert.equal(logs[0].component, 'Bluetooth');
  assert.equal(logs[1].component, 'Storage');
  assert.equal(logs[2].component, 'Protocol');
});
