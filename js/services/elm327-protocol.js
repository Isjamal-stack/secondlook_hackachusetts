/**
 * @fileoverview ELM327 Protocol Handler
 * @module services/elm327-protocol
 * 
 * Implements the ELM327 AT command set and OBD-II PID protocol for vehicle
 * diagnostics. Handles adapter initialization, PID encoding/decoding, and
 * diagnostic trouble code (DTC) management.
 * 
 * Supported PIDs:
 * - 0C: Engine RPM
 * - 0D: Vehicle Speed
 * - 05: Coolant Temperature
 * - 04: Engine Load
 * - 2F: Fuel Level
 * - 11: Throttle Position
 * - 0F: Intake Air Temperature
 * - 10: Mass Air Flow (MAF)
 * 
 * @requires utils/logger
 * @requires utils/error-handler
 * 
 * @example
 * import { ELM327Protocol } from './services/elm327-protocol.js';
 * 
 * const protocol = new ELM327Protocol();
 * await protocol.initialize(sendCommandFn);
 * const rpm = await protocol.requestPID('0C');
 * console.log('RPM:', rpm);
 */

/**
 * ELM327 Protocol Module
 * Handles ELM327 AT commands and OBD-II PID encoding/decoding
 */

import { logger } from '../utils/logger.js';
import { errorHandler } from '../utils/error-handler.js';

export class ELM327Protocol {
    constructor() {
        this.protocolReady = false;
        this.commandQueue = [];
        this.isProcessing = false;
        
        // Supported PIDs and their decoders
        this.pidDecoders = {
            '0C': this.decodeRPM.bind(this),           // Engine RPM
            '0D': this.decodeSpeed.bind(this),         // Vehicle Speed
            '05': this.decodeCoolantTemp.bind(this),   // Coolant Temperature
            '04': this.decodeEngineLoad.bind(this),    // Engine Load
            '2F': this.decodeFuelLevel.bind(this),     // Fuel Level
            '11': this.decodeThrottlePos.bind(this),   // Throttle Position
            '0F': this.decodeIntakeTemp.bind(this),    // Intake Air Temperature
            '10': this.decodeMAF.bind(this)            // Mass Air Flow
        };
    }
    
    /**
     * Initialize ELM327 device
     * 
     * Sends AT commands to configure the ELM327 adapter and negotiates
     * the OBD-II protocol with the vehicle.
     * 
     * @async
     * @param {Function} sendCommandFn - Function that sends commands to device
     * @returns {Promise<boolean>} True if initialization successful
     * @throws {Error} If device doesn't respond with ELM327 identifier
     * @throws {Error} If unable to connect to vehicle
     * @throws {Error} If protocol negotiation timeout
     * 
     * @example
     * const protocol = new ELM327Protocol();
     * await protocol.initialize(async (cmd) => {
     *     return await bluetooth.sendCommand(cmd);
     * });
     * console.log('ELM327 initialized and ready');
     */
    async initialize(sendCommandFn) {
        logger.info('Starting ELM327 initialization...');
        this.sendCommandFn = sendCommandFn;
        
        try {
            // Step 1: Reset
            let response = await this.sendCommand('ATZ');
            logger.debug('Reset response:', response);
            
            if (!response.includes('ELM327')) {
                throw new Error('Device did not respond with ELM327 identifier');
            }
            
            // Wait a bit after reset
            await this.delay(1000);
            
            // Step 2: Echo off
            response = await this.sendCommand('ATE0');
            logger.debug('Echo off response:', response);
            
            // Step 3: Line feeds off
            response = await this.sendCommand('ATL0');
            logger.debug('Line feeds off response:', response);
            
            // Step 4: Headers off
            response = await this.sendCommand('ATH0');
            logger.debug('Headers off response:', response);
            
            // Step 5: Set protocol to auto
            response = await this.sendCommand('ATSP0');
            logger.debug('Set protocol response:', response);
            
            // Step 6: Test with supported PIDs - wait for protocol negotiation
            logger.debug('Testing protocol with 0100...');
            let attempts = 0;
            while (attempts < 10) {
                response = await this.sendCommand('0100');
                logger.debug(`0100 response (attempt ${attempts + 1}):`, response);
                
                if (response.includes('SEARCHING')) {
                    logger.debug('Protocol searching, waiting...');
                    await this.delay(500);
                    attempts++;
                } else if (response.includes('41 00')) {
                    logger.info('Protocol negotiation complete!');
                    this.protocolReady = true;
                    return true;
                } else if (response.includes('NO DATA') || response.includes('UNABLE TO CONNECT')) {
                    throw new Error('Unable to connect to vehicle');
                } else {
                    // Unexpected response, try again
                    await this.delay(500);
                    attempts++;
                }
            }
            
            throw new Error('Protocol negotiation timeout');
            
        } catch (error) {
            logger.error('ELM327 initialization failed:', error);
            errorHandler.handle(error, 'protocol');
            throw error;
        }
    }
    
    /**
     * Send command and wait for response
     */
    async sendCommand(command) {
        if (!this.sendCommandFn) {
            throw new Error('Send command function not set');
        }
        
        logger.debug('Sending ELM327 command:', command);
        const response = await this.sendCommandFn(command);
        logger.debug('Received ELM327 response:', response);
        
        return response;
    }
    
    /**
     * Request PID value from vehicle
     * 
     * @async
     * @param {string} pid - 2-digit hex PID code (e.g., '0C' for RPM)
     * @returns {Promise<number|null>} Decoded PID value or null if failed
     * @throws {Error} If protocol not ready
     * 
     * @example
     * const rpm = await protocol.requestPID('0C');
     * const speed = await protocol.requestPID('0D');
     * console.log(`RPM: ${rpm}, Speed: ${speed} km/h`);
     */
    async requestPID(pid) {
        if (!this.protocolReady) {
            throw new Error('Protocol not ready');
        }
        
        const command = '01' + pid;
        const response = await this.sendCommand(command);
        
        return this.parsePIDResponse(response, pid);
    }
    
    /**
     * Request multiple PIDs at once
     * 
     * @async
     * @param {Array<string>} pids - Array of 2-digit hex PID codes
     * @returns {Promise<Object>} Object mapping PIDs to their values
     * 
     * @example
     * const results = await protocol.requestMultiplePIDs(['0C', '0D', '05']);
     * console.log('RPM:', results['0C']);
     * console.log('Speed:', results['0D']);
     * console.log('Temp:', results['05']);
     */
    async requestMultiplePIDs(pids) {
        const results = {};
        
        for (const pid of pids) {
            try {
                results[pid] = await this.requestPID(pid);
            } catch (error) {
                logger.error(`Failed to get PID ${pid}:`, error);
                results[pid] = null;
            }
        }
        
        return results;
    }
    
    /**
     * Parse PID response
     */
    parsePIDResponse(response, pid) {
        // Clean up response
        response = response.trim().replace(/\s+/g, ' ');
        
        // Check for errors
        if (response.includes('NO DATA') || response.includes('?') || response.includes('ERROR')) {
            return null;
        }
        
        // Expected format: "41 XX YY ZZ..." where XX is the PID
        const match = response.match(/41 ([0-9A-F]{2})((?:\s[0-9A-F]{2})+)/);
        if (!match) {
            logger.warn('Invalid PID response format:', response);
            return null;
        }
        
        const responsePID = match[1];
        const data = match[2].trim().replace(/\s/g, '');
        
        // Verify PID matches
        if (responsePID.toUpperCase() !== pid.toUpperCase()) {
            logger.warn('PID mismatch:', responsePID, 'vs', pid);
            return null;
        }
        
        // Decode based on PID
        const decoder = this.pidDecoders[pid.toUpperCase()];
        if (decoder) {
            return decoder(data);
        }
        
        logger.warn('No decoder for PID:', pid);
        return null;
    }
    
    /**
     * Read diagnostic trouble codes
     */
    async readDTCs() {
        if (!this.protocolReady) {
            throw new Error('Protocol not ready');
        }
        
        const response = await this.sendCommand('03');
        return this.parseDTCResponse(response);
    }
    
    /**
     * Parse DTC response
     */
    parseDTCResponse(response) {
        const dtcs = [];
        
        // Remove spaces and split into bytes
        const clean = response.replace(/\s/g, '');
        
        // DTC format: 43 XX YY ZZ... where XX is count
        if (!clean.startsWith('43')) {
            return dtcs;
        }
        
        // Extract DTC count
        const count = parseInt(clean.substring(2, 4), 16);
        if (count === 0) {
            return dtcs;
        }
        
        // Parse DTCs (2 bytes each)
        let pos = 4;
        while (pos < clean.length - 3) {
            const byte1 = clean.substring(pos, pos + 2);
            const byte2 = clean.substring(pos + 2, pos + 4);
            
            const dtc = this.decodeDTC(byte1 + byte2);
            if (dtc) {
                dtcs.push(dtc);
            }
            
            pos += 4;
        }
        
        return dtcs;
    }
    
    /**
     * Decode DTC from hex
     */
    decodeDTC(hex) {
        const value = parseInt(hex, 16);
        
        // First 2 bits determine the category
        const category = (value >> 14) & 0x03;
        const categories = ['P', 'C', 'B', 'U']; // Powertrain, Chassis, Body, Network
        
        // Next 2 bits are the first digit
        const digit1 = (value >> 12) & 0x03;
        
        // Remaining 12 bits are the last 3 digits
        const digits = value & 0x0FFF;
        
        return categories[category] + digit1.toString() + digits.toString(16).toUpperCase().padStart(3, '0');
    }
    
    /**
     * Clear diagnostic trouble codes
     */
    async clearDTCs() {
        if (!this.protocolReady) {
            throw new Error('Protocol not ready');
        }
        
        const response = await this.sendCommand('04');
        return response.includes('44') || response.includes('OK');
    }
    
    /**
     * PID Decoders
     */
    
    decodeRPM(data) {
        // Formula: ((A*256)+B)/4
        const a = parseInt(data.substring(0, 2), 16);
        const b = parseInt(data.substring(2, 4), 16);
        return Math.round(((a * 256) + b) / 4);
    }
    
    decodeSpeed(data) {
        // Formula: A
        return parseInt(data.substring(0, 2), 16);
    }
    
    decodeCoolantTemp(data) {
        // Formula: A - 40
        return parseInt(data.substring(0, 2), 16) - 40;
    }
    
    decodeEngineLoad(data) {
        // Formula: (A * 100) / 255
        const a = parseInt(data.substring(0, 2), 16);
        return Math.round((a * 100) / 255);
    }
    
    decodeFuelLevel(data) {
        // Formula: (A * 100) / 255
        const a = parseInt(data.substring(0, 2), 16);
        return Math.round((a * 100) / 255);
    }
    
    decodeThrottlePos(data) {
        // Formula: (A * 100) / 255
        const a = parseInt(data.substring(0, 2), 16);
        return Math.round((a * 100) / 255);
    }
    
    decodeIntakeTemp(data) {
        // Formula: A - 40
        return parseInt(data.substring(0, 2), 16) - 40;
    }
    
    decodeMAF(data) {
        // Formula: ((A*256)+B) / 100
        const a = parseInt(data.substring(0, 2), 16);
        const b = parseInt(data.substring(2, 4), 16);
        return ((a * 256) + b) / 100;
    }
    
    /**
     * Helper: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

logger.debug('ELM327Protocol module loaded');
