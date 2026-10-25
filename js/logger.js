/**
 * Centralized logging system for SecondLook
 * Provides consistent logging with levels and optional persistence
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

class Logger {
    constructor() {
        // Set log level based on environment
        // In production, only show WARN and ERROR
        this.level = this.#getLogLevel();
        this.enablePersistence = false;
        this.maxLogs = 100;
        this.logs = [];
    }

    #getLogLevel() {
        // Check if running in development
        const isDev = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.search.includes('debug=true');
        
        return isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
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
        
        // Keep only the last N logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    debug(component, message, data = null) {
        if (!this.#shouldLog(LOG_LEVELS.DEBUG)) return;
        
        const logEntry = this.#formatMessage(LOG_LEVELS.DEBUG, component, message, data);
        console.log(`[${component}] ${message}`, data || '');
        this.#persist(logEntry);
    }

    info(component, message, data = null) {
        if (!this.#shouldLog(LOG_LEVELS.INFO)) return;
        
        const logEntry = this.#formatMessage(LOG_LEVELS.INFO, component, message, data);
        console.log(`[${component}] ${message}`, data || '');
        this.#persist(logEntry);
    }

    warn(component, message, data = null) {
        if (!this.#shouldLog(LOG_LEVELS.WARN)) return;
        
        const logEntry = this.#formatMessage(LOG_LEVELS.WARN, component, message, data);
        console.warn(`[${component}] ${message}`, data || '');
        this.#persist(logEntry);
    }

    error(component, message, error = null) {
        if (!this.#shouldLog(LOG_LEVELS.ERROR)) return;
        
        const logEntry = this.#formatMessage(LOG_LEVELS.ERROR, component, message, {
            error: error?.message,
            stack: error?.stack
        });
        console.error(`[${component}] ${message}`, error || '');
        this.#persist(logEntry);
    }

    /**
     * Get all persisted logs (for debugging or export)
     */
    getLogs() {
        return [...this.logs];
    }

    /**
     * Clear all persisted logs
     */
    clearLogs() {
        this.logs = [];
    }

    /**
     * Export logs as JSON for debugging
     */
    exportLogs() {
        const blob = new Blob([JSON.stringify(this.logs, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secondlook-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Create singleton instance
const logger = new Logger();

// Export for use in other modules
export default logger;
