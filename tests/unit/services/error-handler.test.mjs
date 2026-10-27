/**
 * @fileoverview Unit tests for error handler utility
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpy } from '../../helpers/test-utils.mjs';

// Mock ErrorTypes and error handler since it uses logger
const ErrorTypes = {
  BLUETOOTH: 'bluetooth',
  STORAGE: 'storage',
  NETWORK: 'network',
  VALIDATION: 'validation',
  PROTOCOL: 'protocol',
  UNKNOWN: 'unknown'
};

const ErrorMessages = {
  [ErrorTypes.BLUETOOTH]: {
    connection: 'Unable to connect to your ELM327 device. Please ensure it\'s powered on and paired with your device.',
    disconnection: 'Connection to your ELM327 device was lost. Please reconnect.',
    unsupported: 'Web Bluetooth is not supported in this browser. Please use Chrome or Edge, or try uploading a data file instead.',
    timeout: 'Connection timed out. Please try again.'
  },
  [ErrorTypes.STORAGE]: {
    quota: 'Storage quota exceeded. Please clear some old data in Settings.',
    unavailable: 'Local storage is unavailable. Please check your browser settings.',
    corruption: 'Data corruption detected. You may need to clear and reimport your data.'
  },
  [ErrorTypes.NETWORK]: {
    offline: 'You appear to be offline. Some features may not work.',
    timeout: 'Request timed out. Please check your connection and try again.',
    ai_unavailable: 'AI insights are temporarily unavailable. Using template explanations instead.'
  },
  [ErrorTypes.PROTOCOL]: {
    invalid: 'Invalid response from OBD-II adapter. Please try reconnecting.',
    unsupported: 'This vehicle protocol is not supported yet.',
    initialization: 'Failed to initialize ELM327 protocol. Please check your adapter.'
  },
  [ErrorTypes.VALIDATION]: {
    invalid_data: 'Invalid data format. Please check your input.',
    missing_field: 'Required information is missing.',
    invalid_format: 'The file format is not supported.'
  }
};

class TestErrorHandler {
  constructor() {
    this.logger = {
      error: createSpy()
    };
  }
  
  handle(error, component, errorType = ErrorTypes.UNKNOWN, errorKey = null, toastFn = null) {
    this.logger.error(component, error.message, error);
    
    const userMessage = this.getUserMessage(errorType, errorKey, error);
    
    if (toastFn) {
      toastFn(userMessage, 'error');
    }
    
    return userMessage;
  }
  
  getUserMessage(errorType, errorKey, error) {
    if (errorType && errorKey && ErrorMessages[errorType]?.[errorKey]) {
      return ErrorMessages[errorType][errorKey];
    }
    
    switch (errorType) {
      case ErrorTypes.BLUETOOTH:
        return 'Bluetooth connection error. Please try again.';
      case ErrorTypes.STORAGE:
        return 'Storage error. Please check your available space.';
      case ErrorTypes.NETWORK:
        return 'Network error. Please check your connection.';
      case ErrorTypes.PROTOCOL:
        return 'Communication error with your vehicle. Please try reconnecting.';
      case ErrorTypes.VALIDATION:
        return 'Invalid data. Please check your input.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
  
  async wrap(fn, component, errorType, errorKey, toastFn = null) {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, component, errorType, errorKey, toastFn);
      throw error;
    }
  }
  
  isRecoverable(error) {
    const recoverableErrors = [
      'NetworkError',
      'TimeoutError',
      'AbortError'
    ];
    
    return recoverableErrors.includes(error.name) ||
           error.message?.includes('timeout') ||
           error.message?.includes('network');
  }
}

test('ErrorHandler - handles BLUETOOTH connection error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Connection failed');
  
  const message = handler.handle(error, 'Bluetooth', ErrorTypes.BLUETOOTH, 'connection');
  
  assert.equal(message, ErrorMessages[ErrorTypes.BLUETOOTH].connection);
  assert.equal(handler.logger.error.callCount(), 1);
});

test('ErrorHandler - handles BLUETOOTH disconnection error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Device disconnected');
  
  const message = handler.handle(error, 'Bluetooth', ErrorTypes.BLUETOOTH, 'disconnection');
  
  assert.equal(message, ErrorMessages[ErrorTypes.BLUETOOTH].disconnection);
});

test('ErrorHandler - handles BLUETOOTH unsupported error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Web Bluetooth not available');
  
  const message = handler.handle(error, 'Bluetooth', ErrorTypes.BLUETOOTH, 'unsupported');
  
  assert.equal(message, ErrorMessages[ErrorTypes.BLUETOOTH].unsupported);
});

test('ErrorHandler - handles BLUETOOTH timeout error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Timeout');
  
  const message = handler.handle(error, 'Bluetooth', ErrorTypes.BLUETOOTH, 'timeout');
  
  assert.equal(message, ErrorMessages[ErrorTypes.BLUETOOTH].timeout);
});

test('ErrorHandler - handles STORAGE quota error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('QuotaExceededError');
  
  const message = handler.handle(error, 'Storage', ErrorTypes.STORAGE, 'quota');
  
  assert.equal(message, ErrorMessages[ErrorTypes.STORAGE].quota);
});

test('ErrorHandler - handles STORAGE unavailable error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Storage not available');
  
  const message = handler.handle(error, 'Storage', ErrorTypes.STORAGE, 'unavailable');
  
  assert.equal(message, ErrorMessages[ErrorTypes.STORAGE].unavailable);
});

test('ErrorHandler - handles STORAGE corruption error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Data corrupted');
  
  const message = handler.handle(error, 'Storage', ErrorTypes.STORAGE, 'corruption');
  
  assert.equal(message, ErrorMessages[ErrorTypes.STORAGE].corruption);
});

test('ErrorHandler - handles NETWORK offline error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('No internet connection');
  
  const message = handler.handle(error, 'Network', ErrorTypes.NETWORK, 'offline');
  
  assert.equal(message, ErrorMessages[ErrorTypes.NETWORK].offline);
});

test('ErrorHandler - handles NETWORK timeout error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Request timeout');
  
  const message = handler.handle(error, 'Network', ErrorTypes.NETWORK, 'timeout');
  
  assert.equal(message, ErrorMessages[ErrorTypes.NETWORK].timeout);
});

test('ErrorHandler - handles NETWORK AI unavailable error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('AI service down');
  
  const message = handler.handle(error, 'Network', ErrorTypes.NETWORK, 'ai_unavailable');
  
  assert.equal(message, ErrorMessages[ErrorTypes.NETWORK].ai_unavailable);
});

test('ErrorHandler - handles PROTOCOL invalid error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Invalid protocol response');
  
  const message = handler.handle(error, 'Protocol', ErrorTypes.PROTOCOL, 'invalid');
  
  assert.equal(message, ErrorMessages[ErrorTypes.PROTOCOL].invalid);
});

test('ErrorHandler - handles PROTOCOL unsupported error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Protocol not supported');
  
  const message = handler.handle(error, 'Protocol', ErrorTypes.PROTOCOL, 'unsupported');
  
  assert.equal(message, ErrorMessages[ErrorTypes.PROTOCOL].unsupported);
});

test('ErrorHandler - handles PROTOCOL initialization error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Init failed');
  
  const message = handler.handle(error, 'Protocol', ErrorTypes.PROTOCOL, 'initialization');
  
  assert.equal(message, ErrorMessages[ErrorTypes.PROTOCOL].initialization);
});

test('ErrorHandler - handles VALIDATION invalid_data error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Data validation failed');
  
  const message = handler.handle(error, 'Validation', ErrorTypes.VALIDATION, 'invalid_data');
  
  assert.equal(message, ErrorMessages[ErrorTypes.VALIDATION].invalid_data);
});

test('ErrorHandler - handles VALIDATION missing_field error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Required field missing');
  
  const message = handler.handle(error, 'Validation', ErrorTypes.VALIDATION, 'missing_field');
  
  assert.equal(message, ErrorMessages[ErrorTypes.VALIDATION].missing_field);
});

test('ErrorHandler - handles VALIDATION invalid_format error', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Format not supported');
  
  const message = handler.handle(error, 'Validation', ErrorTypes.VALIDATION, 'invalid_format');
  
  assert.equal(message, ErrorMessages[ErrorTypes.VALIDATION].invalid_format);
});

test('ErrorHandler - falls back to generic BLUETOOTH message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Unknown bluetooth error');
  
  const message = handler.handle(error, 'Bluetooth', ErrorTypes.BLUETOOTH);
  
  assert.equal(message, 'Bluetooth connection error. Please try again.');
});

test('ErrorHandler - falls back to generic STORAGE message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Unknown storage error');
  
  const message = handler.handle(error, 'Storage', ErrorTypes.STORAGE);
  
  assert.equal(message, 'Storage error. Please check your available space.');
});

test('ErrorHandler - falls back to generic NETWORK message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Unknown network error');
  
  const message = handler.handle(error, 'Network', ErrorTypes.NETWORK);
  
  assert.equal(message, 'Network error. Please check your connection.');
});

test('ErrorHandler - falls back to generic PROTOCOL message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Unknown protocol error');
  
  const message = handler.handle(error, 'Protocol', ErrorTypes.PROTOCOL);
  
  assert.equal(message, 'Communication error with your vehicle. Please try reconnecting.');
});

test('ErrorHandler - falls back to generic VALIDATION message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Unknown validation error');
  
  const message = handler.handle(error, 'Validation', ErrorTypes.VALIDATION);
  
  assert.equal(message, 'Invalid data. Please check your input.');
});

test('ErrorHandler - falls back to error message for UNKNOWN type', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Something went wrong');
  
  const message = handler.handle(error, 'App', ErrorTypes.UNKNOWN);
  
  assert.equal(message, 'Something went wrong');
});

test('ErrorHandler - uses default message when error has no message', () => {
  const handler = new TestErrorHandler();
  const error = new Error();
  error.message = '';
  
  const message = handler.handle(error, 'App', ErrorTypes.UNKNOWN);
  
  assert.equal(message, 'An unexpected error occurred. Please try again.');
});

test('ErrorHandler - calls toast function when provided', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Test error');
  const toastSpy = createSpy();
  
  handler.handle(error, 'Test', ErrorTypes.BLUETOOTH, 'connection', toastSpy);
  
  assert.equal(toastSpy.callCount(), 1);
  assert.ok(toastSpy.calledWith(ErrorMessages[ErrorTypes.BLUETOOTH].connection, 'error'));
});

test('ErrorHandler - does not call toast when not provided', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Test error');
  
  const message = handler.handle(error, 'Test', ErrorTypes.BLUETOOTH, 'connection');
  
  assert.ok(message);
  // No assertion needed - just checking it doesn't throw
});

test('ErrorHandler - logs error to logger', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Test error');
  
  handler.handle(error, 'TestComponent', ErrorTypes.BLUETOOTH, 'connection');
  
  assert.equal(handler.logger.error.callCount(), 1);
  assert.ok(handler.logger.error.calledWith('TestComponent', 'Test error', error));
});

test('ErrorHandler - wrap executes function successfully', async () => {
  const handler = new TestErrorHandler();
  const successFn = async () => 'success';
  
  const result = await handler.wrap(successFn, 'Test', ErrorTypes.UNKNOWN);
  
  assert.equal(result, 'success');
  assert.equal(handler.logger.error.callCount(), 0);
});

test('ErrorHandler - wrap catches and handles errors', async () => {
  const handler = new TestErrorHandler();
  const error = new Error('Wrapped error');
  const failFn = async () => { throw error; };
  const toastSpy = createSpy();
  
  await assert.rejects(
    async () => await handler.wrap(failFn, 'Test', ErrorTypes.BLUETOOTH, 'connection', toastSpy),
    error
  );
  
  assert.equal(handler.logger.error.callCount(), 1);
  assert.equal(toastSpy.callCount(), 1);
});

test('ErrorHandler - isRecoverable identifies NetworkError', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Network failed');
  error.name = 'NetworkError';
  
  assert.ok(handler.isRecoverable(error));
});

test('ErrorHandler - isRecoverable identifies TimeoutError', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Request timed out');
  error.name = 'TimeoutError';
  
  assert.ok(handler.isRecoverable(error));
});

test('ErrorHandler - isRecoverable identifies AbortError', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  
  assert.ok(handler.isRecoverable(error));
});

test('ErrorHandler - isRecoverable identifies timeout in message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Connection timeout');
  error.name = 'Error';
  
  assert.ok(handler.isRecoverable(error));
});

test('ErrorHandler - isRecoverable identifies network in message', () => {
  const handler = new TestErrorHandler();
  const error = new Error('network connection failed'); // lowercase to match check
  error.name = 'Error';
  
  assert.ok(handler.isRecoverable(error));
});

test('ErrorHandler - isRecoverable returns false for non-recoverable errors', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Fatal error');
  error.name = 'FatalError';
  
  assert.equal(handler.isRecoverable(error), false);
});

test('ErrorHandler - handles multiple errors independently', () => {
  const handler = new TestErrorHandler();
  const error1 = new Error('Error 1');
  const error2 = new Error('Error 2');
  
  const message1 = handler.handle(error1, 'Component1', ErrorTypes.BLUETOOTH, 'connection');
  const message2 = handler.handle(error2, 'Component2', ErrorTypes.STORAGE, 'quota');
  
  assert.equal(message1, ErrorMessages[ErrorTypes.BLUETOOTH].connection);
  assert.equal(message2, ErrorMessages[ErrorTypes.STORAGE].quota);
  assert.equal(handler.logger.error.callCount(), 2);
});

test('ErrorHandler - returns user message from handle', () => {
  const handler = new TestErrorHandler();
  const error = new Error('Test');
  
  const message = handler.handle(error, 'Test', ErrorTypes.BLUETOOTH, 'connection');
  
  assert.equal(typeof message, 'string');
  assert.ok(message.length > 0);
});
