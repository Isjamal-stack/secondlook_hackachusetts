/**
 * @fileoverview Mock Bluetooth device for testing
 */

/**
 * Mock OBD-II responses for common PIDs
 */
export const MOCK_RESPONSES = {
  // Engine RPM (PID 0C)
  '010C': '41 0C 1F 40',  // ~2000 RPM
  
  // Vehicle Speed (PID 0D)
  '010D': '41 0D 2D',     // 45 km/h
  
  // Coolant Temperature (PID 05)
  '0105': '41 05 B7',     // 90°C
  
  // Engine Load (PID 04)
  '0104': '41 04 64',     // 39%
  
  // Throttle Position (PID 11)
  '0111': '41 11 32',     // 20%
  
  // Fuel Level (PID 2F)
  '012F': '41 2F 96',     // 75%
  
  // Supported PIDs (PID 00)
  '0100': '41 00 BE 3F A8 13',
  
  // AT Commands
  'ATZ': 'ELM327 v1.5',
  'ATE0': 'OK',
  'ATSP0': 'OK',
  'ATH1': 'OK',
  'ATAT1': 'OK'
};

/**
 * Create a mock GATT characteristic for Bluetooth communication
 * @param {Object} options - Configuration options
 * @returns {Object} Mock characteristic
 */
function createMockCharacteristic(options = {}) {
  const {
    uuid = '0000fff1-0000-1000-8000-00805f9b34fb',
    responses = MOCK_RESPONSES,
    delay = 10
  } = options;
  
  let notificationCallback = null;
  let isNotifying = false;
  
  return {
    uuid,
    
    /**
     * Write value to characteristic (send command)
     * @param {ArrayBuffer} value - Command to send
     * @returns {Promise<void>}
     */
    async writeValue(value) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Convert ArrayBuffer to command string
      const command = new TextDecoder().decode(value).trim().toUpperCase();
      
      // Find response
      const response = responses[command] || 'NO DATA';
      
      // If notifications are active, send response
      if (isNotifying && notificationCallback) {
        const responseBuffer = new TextEncoder().encode(response + '\r>');
        await new Promise(resolve => setTimeout(resolve, delay));
        notificationCallback({
          target: {
            value: responseBuffer.buffer
          }
        });
      }
    },
    
    /**
     * Start notifications
     * @returns {Promise<void>}
     */
    async startNotifications() {
      isNotifying = true;
    },
    
    /**
     * Stop notifications
     * @returns {Promise<void>}
     */
    async stopNotifications() {
      isNotifying = false;
      notificationCallback = null;
    },
    
    /**
     * Add event listener for characteristic value changes
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    addEventListener(event, callback) {
      if (event === 'characteristicvaluechanged') {
        notificationCallback = callback;
      }
    },
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    removeEventListener(event, callback) {
      if (event === 'characteristicvaluechanged') {
        notificationCallback = null;
      }
    }
  };
}

/**
 * Create a mock GATT service
 * @param {Object} options - Configuration options
 * @returns {Object} Mock service
 */
function createMockService(options = {}) {
  const { uuid = '0000fff0-0000-1000-8000-00805f9b34fb' } = options;
  const characteristic = createMockCharacteristic(options);
  
  return {
    uuid,
    
    /**
     * Get characteristic by UUID
     * @param {string} characteristicUuid - Characteristic UUID
     * @returns {Promise<Object>} Mock characteristic
     */
    async getCharacteristic(characteristicUuid) {
      return characteristic;
    }
  };
}

/**
 * Create a mock GATT server
 * @param {Object} options - Configuration options
 * @returns {Object} Mock GATT server
 */
function createMockGattServer(options = {}) {
  const service = createMockService(options);
  let connected = false;
  
  return {
    connected: false,
    
    /**
     * Connect to GATT server
     * @returns {Promise<Object>} This server
     */
    async connect() {
      connected = true;
      this.connected = true;
      return this;
    },
    
    /**
     * Disconnect from GATT server
     */
    disconnect() {
      connected = false;
      this.connected = false;
    },
    
    /**
     * Get primary service by UUID
     * @param {string} serviceUuid - Service UUID
     * @returns {Promise<Object>} Mock service
     */
    async getPrimaryService(serviceUuid) {
      if (!connected) {
        throw new Error('GATT Server is disconnected');
      }
      return service;
    }
  };
}

/**
 * Create a mock Bluetooth device
 * @param {Object} options - Configuration options
 * @returns {Object} Mock Bluetooth device
 */
export function createMockBluetoothDevice(options = {}) {
  const {
    name = 'Mock ELM327',
    id = 'mock-device-001',
    responses = MOCK_RESPONSES
  } = options;
  
  const gatt = createMockGattServer({ ...options, responses });
  
  return {
    id,
    name,
    gatt,
    
    /**
     * Add event listener for device events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    addEventListener(event, callback) {
      // Mock implementation
    },
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    removeEventListener(event, callback) {
      // Mock implementation
    }
  };
}

/**
 * Create a mock Web Bluetooth navigator
 * @param {Object} options - Configuration options
 * @returns {Object} Mock navigator.bluetooth
 */
export function createMockBluetooth(options = {}) {
  const device = createMockBluetoothDevice(options);
  
  return {
    /**
     * Request Bluetooth device
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Mock device
     */
    async requestDevice(requestOptions) {
      // Simulate user selecting device
      await new Promise(resolve => setTimeout(resolve, 100));
      return device;
    },
    
    /**
     * Get availability of Bluetooth
     * @returns {Promise<boolean>}
     */
    async getAvailability() {
      return true;
    }
  };
}

/**
 * Create a mock that simulates connection failure
 * @param {string} errorMessage - Error message to throw
 * @returns {Object} Mock Bluetooth that throws errors
 */
export function createFailingMockBluetooth(errorMessage = 'Connection failed') {
  return {
    async requestDevice() {
      throw new Error(errorMessage);
    },
    async getAvailability() {
      return false;
    }
  };
}

/**
 * Create a mock that simulates disconnect
 * @returns {Object} Mock device that disconnects after delay
 */
export function createDisconnectingMockDevice(disconnectAfter = 1000) {
  const device = createMockBluetoothDevice();
  
  setTimeout(() => {
    device.gatt.disconnect();
    device.dispatchEvent(new Event('gattserverdisconnected'));
  }, disconnectAfter);
  
  return device;
}
