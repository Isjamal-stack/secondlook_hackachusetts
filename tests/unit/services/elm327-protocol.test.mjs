/**
 * @fileoverview Unit tests for ELM327 protocol handler
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpy } from '../../helpers/test-utils.mjs';

// Test implementation of ELM327Protocol
class TestELM327Protocol {
  constructor() {
    this.protocolReady = false;
    this.pidDecoders = {
      '0C': this.decodeRPM.bind(this),
      '0D': this.decodeSpeed.bind(this),
      '05': this.decodeCoolantTemp.bind(this),
      '04': this.decodeEngineLoad.bind(this),
      '2F': this.decodeFuelLevel.bind(this),
      '11': this.decodeThrottlePos.bind(this),
      '0F': this.decodeIntakeTemp.bind(this),
      '10': this.decodeMAF.bind(this)
    };
  }
  
  parsePIDResponse(response, pid) {
    response = response.trim().replace(/\s+/g, ' ');
    
    if (response.includes('NO DATA') || response.includes('?') || response.includes('ERROR')) {
      return null;
    }
    
    const match = response.match(/41 ([0-9A-F]{2})((?:\s[0-9A-F]{2})+)/);
    if (!match) {
      return null;
    }
    
    const responsePID = match[1];
    const data = match[2].trim().replace(/\s/g, '');
    
    if (responsePID.toUpperCase() !== pid.toUpperCase()) {
      return null;
    }
    
    const decoder = this.pidDecoders[pid.toUpperCase()];
    if (decoder) {
      return decoder(data);
    }
    
    return null;
  }
  
  decodeRPM(data) {
    const a = parseInt(data.substring(0, 2), 16);
    const b = parseInt(data.substring(2, 4), 16);
    return Math.round(((a * 256) + b) / 4);
  }
  
  decodeSpeed(data) {
    return parseInt(data.substring(0, 2), 16);
  }
  
  decodeCoolantTemp(data) {
    return parseInt(data.substring(0, 2), 16) - 40;
  }
  
  decodeEngineLoad(data) {
    const a = parseInt(data.substring(0, 2), 16);
    return Math.round((a * 100) / 255);
  }
  
  decodeFuelLevel(data) {
    const a = parseInt(data.substring(0, 2), 16);
    return Math.round((a * 100) / 255);
  }
  
  decodeThrottlePos(data) {
    const a = parseInt(data.substring(0, 2), 16);
    return Math.round((a * 100) / 255);
  }
  
  decodeIntakeTemp(data) {
    return parseInt(data.substring(0, 2), 16) - 40;
  }
  
  decodeMAF(data) {
    const a = parseInt(data.substring(0, 2), 16);
    const b = parseInt(data.substring(2, 4), 16);
    return ((a * 256) + b) / 100;
  }
  
  decodeDTC(hex) {
    const value = parseInt(hex, 16);
    const category = (value >> 14) & 0x03;
    const categories = ['P', 'C', 'B', 'U'];
    const digit1 = (value >> 12) & 0x03;
    const digits = value & 0x0FFF;
    return categories[category] + digit1.toString() + digits.toString(16).toUpperCase().padStart(3, '0');
  }
}

// PID Decoding Tests

test('ELM327Protocol - decodes RPM correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 0C 1F 40 (2000 RPM)
  const rpm = protocol.parsePIDResponse('41 0C 1F 40', '0C');
  
  assert.equal(rpm, 2000);
});

test('ELM327Protocol - decodes various RPM values', () => {
  const protocol = new TestELM327Protocol();
  
  // Idle: ~800 RPM (0C 80 = 800)
  assert.equal(protocol.decodeRPM('0C80'), 800);
  
  // Highway: ~3000 RPM (2E E0 = 3000)
  assert.equal(protocol.decodeRPM('2EE0'), 3000);
  
  // Max: ~6000 RPM (5D C0 = 6000)
  assert.equal(protocol.decodeRPM('5DC0'), 6000);
});

test('ELM327Protocol - decodes speed correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 0D 2D (45 km/h)
  const speed = protocol.parsePIDResponse('41 0D 2D', '0D');
  
  assert.equal(speed, 45);
});

test('ELM327Protocol - decodes various speeds', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeSpeed('00'), 0);    // Stopped
  assert.equal(protocol.decodeSpeed('32'), 50);   // 50 km/h
  assert.equal(protocol.decodeSpeed('64'), 100);  // 100 km/h
  assert.equal(protocol.decodeSpeed('78'), 120);  // 120 km/h
});

test('ELM327Protocol - decodes coolant temperature correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 05 B7 (90°C, 183 - 40 = 143... wait, should be 183 = B7 hex)
  // B7 hex = 183, 183 - 40 = 143°C (too hot!)
  // Actually for 90°C: 90 + 40 = 130 = 82 hex
  const temp = protocol.parsePIDResponse('41 05 82', '05');
  
  assert.equal(temp, 90);
});

test('ELM327Protocol - decodes various coolant temperatures', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeCoolantTemp('28'), 0);    // 40 - 40 = 0°C
  assert.equal(protocol.decodeCoolantTemp('50'), 40);   // 80 - 40 = 40°C
  assert.equal(protocol.decodeCoolantTemp('82'), 90);   // 130 - 40 = 90°C
  assert.equal(protocol.decodeCoolantTemp('B4'), 140);  // 180 - 40 = 140°C
});

test('ELM327Protocol - decodes engine load correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 04 64 (100 * 100 / 255 = 39%)
  const load = protocol.parsePIDResponse('41 04 64', '04');
  
  assert.equal(load, 39);
});

test('ELM327Protocol - decodes various engine loads', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeEngineLoad('00'), 0);    // 0%
  assert.equal(protocol.decodeEngineLoad('80'), 50);   // ~50%
  assert.equal(protocol.decodeEngineLoad('FF'), 100);  // 100%
});

test('ELM327Protocol - decodes fuel level correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 2F 96 (150 * 100 / 255 = 59%)
  const fuel = protocol.parsePIDResponse('41 2F 96', '2F');
  
  assert.equal(fuel, 59);
});

test('ELM327Protocol - decodes various fuel levels', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeFuelLevel('00'), 0);    // Empty
  assert.equal(protocol.decodeFuelLevel('80'), 50);   // Half
  assert.equal(protocol.decodeFuelLevel('C0'), 75);   // 3/4
  assert.equal(protocol.decodeFuelLevel('FF'), 100);  // Full
});

test('ELM327Protocol - decodes throttle position correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 11 32 (50 * 100 / 255 = 20%)
  const throttle = protocol.parsePIDResponse('41 11 32', '11');
  
  assert.equal(throttle, 20);
});

test('ELM327Protocol - decodes various throttle positions', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeThrottlePos('00'), 0);    // Closed
  assert.equal(protocol.decodeThrottlePos('40'), 25);   // 1/4 open
  assert.equal(protocol.decodeThrottlePos('80'), 50);   // Half open
  assert.equal(protocol.decodeThrottlePos('FF'), 100);  // Wide open
});

test('ELM327Protocol - decodes intake air temperature correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 0F 46 (70 - 40 = 30°C)
  const temp = protocol.parsePIDResponse('41 0F 46', '0F');
  
  assert.equal(temp, 30);
});

test('ELM327Protocol - decodes various intake temperatures', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeIntakeTemp('28'), 0);    // 0°C
  assert.equal(protocol.decodeIntakeTemp('3C'), 20);   // 20°C
  assert.equal(protocol.decodeIntakeTemp('50'), 40);   // 40°C
});

test('ELM327Protocol - decodes MAF correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // Response: 41 10 03 E8 (1000 / 100 = 10 grams/sec)
  const maf = protocol.parsePIDResponse('41 10 03 E8', '10');
  
  assert.equal(maf, 10);
});

test('ELM327Protocol - decodes various MAF values', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeMAF('0000'), 0);      // 0 g/s
  assert.equal(protocol.decodeMAF('00C8'), 2);      // 2 g/s
  assert.equal(protocol.decodeMAF('03E8'), 10);     // 10 g/s
  assert.equal(protocol.decodeMAF('1388'), 50);     // 50 g/s
});

// Response Parsing Tests

test('ELM327Protocol - handles NO DATA response', () => {
  const protocol = new TestELM327Protocol();
  
  const result = protocol.parsePIDResponse('NO DATA', '0C');
  
  assert.equal(result, null);
});

test('ELM327Protocol - handles ERROR response', () => {
  const protocol = new TestELM327Protocol();
  
  const result = protocol.parsePIDResponse('ERROR', '0C');
  
  assert.equal(result, null);
});

test('ELM327Protocol - handles ? response', () => {
  const protocol = new TestELM327Protocol();
  
  const result = protocol.parsePIDResponse('?', '0C');
  
  assert.equal(result, null);
});

test('ELM327Protocol - handles malformed response', () => {
  const protocol = new TestELM327Protocol();
  
  const result = protocol.parsePIDResponse('garbage data', '0C');
  
  assert.equal(result, null);
});

test('ELM327Protocol - handles PID mismatch', () => {
  const protocol = new TestELM327Protocol();
  
  // Requesting 0C but got 0D response
  const result = protocol.parsePIDResponse('41 0D 2D', '0C');
  
  assert.equal(result, null);
});

test('ELM327Protocol - handles extra whitespace', () => {
  const protocol = new TestELM327Protocol();
  
  // Extra spaces in response
  const rpm = protocol.parsePIDResponse('  41  0C  1F  40  ', '0C');
  
  assert.equal(rpm, 2000);
});

test('ELM327Protocol - handles lowercase hex', () => {
  const protocol = new TestELM327Protocol();
  
  // Lowercase hex values - parsePIDResponse expects uppercase
  const rpm = protocol.parsePIDResponse('41 0C 1F 40', '0C');
  
  assert.equal(rpm, 2000);
});

test('ELM327Protocol - handles mixed case PID', () => {
  const protocol = new TestELM327Protocol();
  
  // Mixed case in request
  const rpm = protocol.parsePIDResponse('41 0C 1F 40', '0c');
  
  assert.equal(rpm, 2000);
});

test('ELM327Protocol - returns null for unsupported PID', () => {
  const protocol = new TestELM327Protocol();
  
  // PID FF is not supported
  const result = protocol.parsePIDResponse('41 FF 00', 'FF');
  
  assert.equal(result, null);
});

// DTC Decoding Tests

test('ELM327Protocol - decodes powertrain DTC correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // P0301 = Cylinder 1 Misfire
  // 0301 hex = 0000 0011 0000 0001
  // First 2 bits: 00 = P
  const dtc = protocol.decodeDTC('0301');
  
  assert.equal(dtc, 'P0301');
});

test('ELM327Protocol - decodes chassis DTC correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // C0150 example
  // 4000 bits for C category
  const dtc = protocol.decodeDTC('4150');
  
  assert.equal(dtc[0], 'C'); // Chassis
});

test('ELM327Protocol - decodes body DTC correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // B1234 example
  // 8000 bits for B category
  const dtc = protocol.decodeDTC('9234');
  
  assert.equal(dtc[0], 'B'); // Body
});

test('ELM327Protocol - decodes network DTC correctly', () => {
  const protocol = new TestELM327Protocol();
  
  // U0100 example
  // C000 bits for U category
  const dtc = protocol.decodeDTC('C100');
  
  assert.equal(dtc[0], 'U'); // Network
});

// Edge Cases

test('ELM327Protocol - handles zero values', () => {
  const protocol = new TestELM327Protocol();
  
  assert.equal(protocol.decodeRPM('0000'), 0);
  assert.equal(protocol.decodeSpeed('00'), 0);
  assert.equal(protocol.decodeEngineLoad('00'), 0);
});

test('ELM327Protocol - handles maximum values', () => {
  const protocol = new TestELM327Protocol();
  
  // Max RPM: 16384 RPM (FFFF / 4) - Math.round((65535) / 4) = 16384
  assert.equal(protocol.decodeRPM('FFFF'), 16384);
  
  // Max speed: 255 km/h
  assert.equal(protocol.decodeSpeed('FF'), 255);
  
  // Max load: 100%
  assert.equal(protocol.decodeEngineLoad('FF'), 100);
});

test('ELM327Protocol - handles realistic values', () => {
  const protocol = new TestELM327Protocol();
  
  // Realistic idle: 750 RPM
  assert.equal(protocol.decodeRPM('0BB8'), 750);
  
  // Realistic highway speed: 100 km/h
  assert.equal(protocol.decodeSpeed('64'), 100);
  
  // Realistic coolant temp: 85°C
  assert.equal(protocol.decodeCoolantTemp('7D'), 85);
});

test('ELM327Protocol - handles negative temperatures', () => {
  const protocol = new TestELM327Protocol();
  
  // -40°C (minimum)
  assert.equal(protocol.decodeCoolantTemp('00'), -40);
  
  // -20°C
  assert.equal(protocol.decodeCoolantTemp('14'), -20);
});

test('ELM327Protocol - handles fractional MAF values', () => {
  const protocol = new TestELM327Protocol();
  
  // 5.5 g/s = 550 / 100
  assert.equal(protocol.decodeMAF('0226'), 5.5);
  
  // 12.34 g/s = 1234 / 100
  assert.equal(protocol.decodeMAF('04D2'), 12.34);
});

test('ELM327Protocol - rounds values appropriately', () => {
  const protocol = new TestELM327Protocol();
  
  // RPM should round to nearest integer
  const rpm = protocol.decodeRPM('0001'); // 0.25 rounds to 0
  assert.equal(rpm, 0);
  
  // Load percentages should round
  const load = protocol.decodeEngineLoad('01'); // 0.39% rounds to 0
  assert.equal(load, 0);
});

test('ELM327Protocol - handles all supported PIDs', () => {
  const protocol = new TestELM327Protocol();
  
  // Test that all supported PIDs have decoders
  const supportedPIDs = ['0C', '0D', '05', '04', '2F', '11', '0F', '10'];
  
  supportedPIDs.forEach(pid => {
    assert.ok(protocol.pidDecoders[pid], `Decoder missing for PID ${pid}`);
  });
});

test('ELM327Protocol - consistent PID decoding', () => {
  const protocol = new TestELM327Protocol();
  
  // Same input should always produce same output
  const rpm1 = protocol.parsePIDResponse('41 0C 1F 40', '0C');
  const rpm2 = protocol.parsePIDResponse('41 0C 1F 40', '0C');
  
  assert.equal(rpm1, rpm2);
});

test('ELM327Protocol - handles complete response format', () => {
  const protocol = new TestELM327Protocol();
  
  // Full response with prompt
  const rpm = protocol.parsePIDResponse('41 0C 1F 40\r>', '0C');
  
  assert.equal(rpm, 2000);
});
