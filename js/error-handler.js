/**
 * Centralized error handling for SecondLook
 * Provides consistent error handling and user-friendly messages
 */

import logger from './logger.js';

/**
 * Error types for categorization
 */
export const ErrorTypes = {
    BLUETOOTH: 'bluetooth',
    STORAGE: 'storage',
    NETWORK: 'network',
    VALIDATION: 'validation',
    PROTOCOL: 'protocol',
    UNKNOWN: 'unknown'
};

/**
 * User-friendly error messages
 */
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

/**
 * Error handler class
 */
class ErrorHandler {
    /**
     * Handle an error with appropriate logging and user notification
     * @param {Error} error - The error object
     * @param {string} component - Component where error occurred
     * @param {string} errorType - Type of error (from ErrorTypes)
     * @param {string} errorKey - Specific error key for user message
     * @param {Function} toastFn - Optional toast notification function
     */
    handle(error, component, errorType = ErrorTypes.UNKNOWN, errorKey = null, toastFn = null) {
        // Log the error
        logger.error(component, error.message, error);

        // Get user-friendly message
        const userMessage = this.getUserMessage(errorType, errorKey, error);

        // Show toast if function provided
        if (toastFn) {
            toastFn(userMessage, 'error');
        }

        // Return the user message for further handling
        return userMessage;
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(errorType, errorKey, error) {
        // Try to get specific message
        if (errorType && errorKey && ErrorMessages[errorType]?.[errorKey]) {
            return ErrorMessages[errorType][errorKey];
        }

        // Fall back to generic messages
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

    /**
     * Wrap async functions with error handling
     */
    async wrap(fn, component, errorType, errorKey, toastFn = null) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, component, errorType, errorKey, toastFn);
            throw error; // Re-throw for caller to handle
        }
    }

    /**
     * Check if error is recoverable
     */
    isRecoverable(error) {
        // Certain errors can be recovered from
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

// Create singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;
