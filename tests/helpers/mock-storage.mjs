/**
 * @fileoverview Mock IndexedDB storage for testing
 */

/**
 * Create a mock IndexedDB database
 * @param {Object} options - Configuration options
 * @returns {Object} Mock database
 */
export function createMockDatabase(options = {}) {
  const {
    name = 'SecondLookDB',
    version = 1,
    stores = ['sessions', 'settings']
  } = options;
  
  const data = new Map();
  stores.forEach(store => data.set(store, new Map()));
  
  return {
    name,
    version,
    data,
    
    /**
     * Get object store
     * @param {string} storeName - Store name
     * @param {string} mode - Transaction mode
     * @returns {Object} Mock object store
     */
    transaction(storeNames, mode = 'readonly') {
      const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
      
      return {
        objectStore(storeName) {
          if (!data.has(storeName)) {
            throw new Error(`Object store '${storeName}' not found`);
          }
          
          const storeData = data.get(storeName);
          
          return {
            /**
             * Get value by key
             * @param {string} key - Key
             * @returns {Object} Request object
             */
            get(key) {
              return {
                onsuccess: null,
                onerror: null,
                result: storeData.get(key),
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Put value
             * @param {any} value - Value to store
             * @param {string} key - Key (optional)
             * @returns {Object} Request object
             */
            put(value, key) {
              const actualKey = key || value.id || value.sessionId;
              storeData.set(actualKey, value);
              
              return {
                onsuccess: null,
                onerror: null,
                result: actualKey,
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Add value
             * @param {any} value - Value to store
             * @param {string} key - Key (optional)
             * @returns {Object} Request object
             */
            add(value, key) {
              const actualKey = key || value.id || value.sessionId;
              if (storeData.has(actualKey)) {
                const error = new Error('Key already exists');
                return {
                  onsuccess: null,
                  onerror: null,
                  error,
                  addEventListener(event, callback) {
                    if (event === 'error') {
                      this.onerror = callback;
                      setTimeout(() => callback({ target: this }), 0);
                    }
                  }
                };
              }
              return this.put(value, key);
            },
            
            /**
             * Delete value by key
             * @param {string} key - Key
             * @returns {Object} Request object
             */
            delete(key) {
              storeData.delete(key);
              
              return {
                onsuccess: null,
                onerror: null,
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Get all values
             * @returns {Object} Request object
             */
            getAll() {
              return {
                onsuccess: null,
                onerror: null,
                result: Array.from(storeData.values()),
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Get all keys
             * @returns {Object} Request object
             */
            getAllKeys() {
              return {
                onsuccess: null,
                onerror: null,
                result: Array.from(storeData.keys()),
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Clear all data
             * @returns {Object} Request object
             */
            clear() {
              storeData.clear();
              
              return {
                onsuccess: null,
                onerror: null,
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            },
            
            /**
             * Count items in store
             * @returns {Object} Request object
             */
            count() {
              return {
                onsuccess: null,
                onerror: null,
                result: storeData.size,
                addEventListener(event, callback) {
                  if (event === 'success') {
                    this.onsuccess = callback;
                    setTimeout(() => callback({ target: this }), 0);
                  }
                }
              };
            }
          };
        }
      };
    },
    
    /**
     * Close database
     */
    close() {
      // Mock implementation
    }
  };
}

/**
 * Create a mock IndexedDB
 * @returns {Object} Mock indexedDB
 */
export function createMockIndexedDB() {
  const databases = new Map();
  
  return {
    /**
     * Open database
     * @param {string} name - Database name
     * @param {number} version - Database version
     * @returns {Object} Request object
     */
    open(name, version = 1) {
      let db = databases.get(name);
      
      if (!db) {
        db = createMockDatabase({ name, version });
        databases.set(name, db);
      }
      
      return {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: db,
        addEventListener(event, callback) {
          if (event === 'success') {
            this.onsuccess = callback;
            setTimeout(() => callback({ target: this }), 0);
          } else if (event === 'upgradeneeded') {
            this.onupgradeneeded = callback;
            if (!databases.has(name)) {
              setTimeout(() => callback({ target: this }), 0);
            }
          }
        }
      };
    },
    
    /**
     * Delete database
     * @param {string} name - Database name
     * @returns {Object} Request object
     */
    deleteDatabase(name) {
      databases.delete(name);
      
      return {
        onsuccess: null,
        onerror: null,
        addEventListener(event, callback) {
          if (event === 'success') {
            this.onsuccess = callback;
            setTimeout(() => callback({ target: this }), 0);
          }
        }
      };
    }
  };
}

/**
 * Create simple in-memory storage (for localStorage/sessionStorage)
 * @returns {Object} Mock storage
 */
export function createMockStorage() {
  const store = new Map();
  
  return {
    /**
     * Get item
     * @param {string} key - Key
     * @returns {string|null} Value
     */
    getItem(key) {
      return store.get(key) || null;
    },
    
    /**
     * Set item
     * @param {string} key - Key
     * @param {string} value - Value
     */
    setItem(key, value) {
      store.set(key, String(value));
    },
    
    /**
     * Remove item
     * @param {string} key - Key
     */
    removeItem(key) {
      store.delete(key);
    },
    
    /**
     * Clear all items
     */
    clear() {
      store.clear();
    },
    
    /**
     * Get number of items
     */
    get length() {
      return store.size;
    },
    
    /**
     * Get key by index
     * @param {number} index - Index
     * @returns {string|null} Key
     */
    key(index) {
      return Array.from(store.keys())[index] || null;
    }
  };
}

/**
 * Create a failing mock database (for error testing)
 * @param {string} errorMessage - Error message
 * @returns {Object} Mock indexedDB that fails
 */
export function createFailingMockIndexedDB(errorMessage = 'Database error') {
  return {
    open() {
      return {
        onsuccess: null,
        onerror: null,
        error: new Error(errorMessage),
        addEventListener(event, callback) {
          if (event === 'error') {
            this.onerror = callback;
            setTimeout(() => callback({ target: this }), 0);
          }
        }
      };
    },
    deleteDatabase() {
      return this.open();
    }
  };
}
