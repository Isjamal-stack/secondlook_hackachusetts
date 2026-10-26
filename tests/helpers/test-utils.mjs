/**
 * @fileoverview Test utility functions for SecondLook tests
 */

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock timestamp
 * @param {number} offset - Offset from now in milliseconds
 * @returns {number}
 */
export function mockTimestamp(offset = 0) {
  return Date.now() + offset;
}

/**
 * Create a mock OBD-II reading
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock reading
 */
export function createMockReading(overrides = {}) {
  return {
    timestamp: Date.now(),
    rpm: 2000,
    speed: 45,
    coolant: 90,
    engineLoad: 35,
    throttle: 25,
    fuelLevel: 75,
    source: 'demo',
    ...overrides
  };
}

/**
 * Create a mock session
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock session
 */
export function createMockSession(overrides = {}) {
  const now = Date.now();
  return {
    sessionId: `test-session-${now}`,
    startTime: now,
    endTime: now + 300000, // 5 minutes
    vehicleInfo: {
      make: 'Test',
      model: 'Vehicle',
      year: 2024
    },
    readings: [createMockReading()],
    ...overrides
  };
}

/**
 * Capture console output during test
 * @param {Function} fn - Function to execute
 * @returns {Promise<{output: string[], result: any}>}
 */
export async function captureConsole(fn) {
  const output = [];
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => output.push(['log', ...args]);
  console.error = (...args) => output.push(['error', ...args]);
  
  try {
    const result = await fn();
    return { output, result };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/**
 * Create a spy function that tracks calls
 * @returns {Object} Spy function with tracking
 */
export function createSpy() {
  const calls = [];
  const spy = function(...args) {
    calls.push(args);
    return spy.returnValue;
  };
  spy.calls = calls;
  spy.callCount = () => calls.length;
  spy.calledWith = (...args) => calls.some(call => 
    call.length === args.length && call.every((arg, i) => arg === args[i])
  );
  spy.returnValue = undefined;
  spy.reset = () => calls.length = 0;
  return spy;
}

/**
 * Assert that a value is within a range
 * @param {number} actual - Actual value
 * @param {number} expected - Expected value
 * @param {number} tolerance - Acceptable difference
 */
export function assertWithinRange(actual, expected, tolerance = 0.01) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Expected ${actual} to be within ${tolerance} of ${expected}, but difference was ${diff}`);
  }
}

/**
 * Create a mock timer that can be manually advanced
 * @returns {Object} Mock timer with control functions
 */
export function createMockTimer() {
  let currentTime = Date.now();
  const timers = new Map();
  let nextId = 1;
  
  return {
    now: () => currentTime,
    advance: (ms) => {
      currentTime += ms;
      // Trigger any expired timers
      for (const [id, { time, callback }] of timers.entries()) {
        if (time <= currentTime) {
          callback();
          timers.delete(id);
        }
      }
    },
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { time: currentTime + ms, callback });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    setInterval: (callback, ms) => {
      const id = nextId++;
      const intervalCallback = () => {
        callback();
        timers.set(id, { time: currentTime + ms, callback: intervalCallback });
      };
      timers.set(id, { time: currentTime + ms, callback: intervalCallback });
      return id;
    },
    clearInterval: (id) => {
      timers.delete(id);
    },
    reset: () => {
      currentTime = Date.now();
      timers.clear();
      nextId = 1;
    }
  };
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Assert deep equality
 * @param {any} actual - Actual value
 * @param {any} expected - Expected value
 */
export function assertDeepEqual(actual, expected) {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(`Expected:\n${expectedStr}\n\nActual:\n${actualStr}`);
  }
}
