/**
 * @fileoverview Bluetooth Manager for ELM327 OBD-II Adapters
 * @module services/bluetooth-manager
 * 
 * Provides Web Bluetooth API integration for connecting to ELM327 OBD-II
 * adapters. Handles connection management, command transmission, and response
 * handling. Also includes TCP emulator support for development without hardware.
 * 
 * Supported features:
 * - Web Bluetooth API device pairing
 * - GATT server connection
 * - Characteristic notifications
 * - Command/response protocol
 * - Mock responses for testing
 * 
 * @requires utils/logger
 * @requires utils/error-handler
 * 
 * @example
 * import { BluetoothManager } from './services/bluetooth-manager.js';
 * 
 * const bluetooth = new BluetoothManager();
 * await bluetooth.connect();
 * const response = await bluetooth.sendCommand('010C'); // Request RPM
 * await bluetooth.disconnect();
 */

/**
 * Bluetooth Manager Module
 * Handles Web Bluetooth API communication with ELM327 devices
 * Also supports TCP connection for emulator testing
 */

import logger from '../utils/logger.js';
import errorHandler, { ErrorTypes } from '../utils/error-handler.js';

export class BluetoothManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.connected = false;
        this.responseBuffer = '';
        this.responseCallback = null;
        this.useTCP = false;
        this.tcpHost = 'localhost';
        this.tcpPort = 35000;
    }
    
    /**
     * Check if Web Bluetooth is supported
     */
    isSupported() {
        return 'bluetooth' in navigator;
    }
    
    /**
     * Connect to ELM327 device via Bluetooth
     * 
     * Prompts user to select a Bluetooth device, connects to its GATT server,
     * and subscribes to characteristic notifications for receiving data.
     * 
     * @async
     * @returns {Promise<boolean>} Resolves to true when connection successful
     * @throws {Error} If device selection cancelled or connection fails
     * @throws {Error} If Web Bluetooth API not supported
     * 
     * @example
     * const bluetooth = new BluetoothManager();
     * try {
     *     await bluetooth.connect();
     *     console.log('Connected to OBD-II adapter');
     * } catch (error) {
     *     console.error('Failed to connect:', error.message);
     * }
     */
    async connect() {
        logger.info('Starting Bluetooth connection...');
        
        try {
            // Request device
            logger.debug('Requesting Bluetooth device...');
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['serial_port'] },
                    { namePrefix: 'OBD' },
                    { namePrefix: 'ELM' },
                    { namePrefix: 'OBDII' }
                ],
                optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'] // Common SPP service
            });
            
            logger.info('Device selected:', this.device.name);
            
            // Connect to GATT server
            logger.debug('Connecting to GATT server...');
            this.server = await this.device.gatt.connect();
            logger.debug('GATT server connected');
            
            // Get primary service
            logger.debug('Getting primary service...');
            const service = await this.server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
            logger.debug('Service obtained');
            
            // Get characteristic for TX/RX
            logger.debug('Getting characteristic...');
            this.characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
            logger.debug('Characteristic obtained');
            
            // Subscribe to notifications
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotification.bind(this));
            logger.debug('Subscribed to notifications');
            
            this.connected = true;
            logger.info('Bluetooth connection successful');
            
            return true;
            
        } catch (error) {
            logger.error('Bluetooth connection failed:', error);
            errorHandler.handle(error, 'bluetooth');
            throw error;
        }
    }
    
    /**
     * Connect via TCP (for emulator testing)
     */
    async connectTCP() {
        logger.info(`Connecting to TCP emulator at ${this.tcpHost}:${this.tcpPort}...`);
        
        // Note: Web browsers don't support raw TCP sockets directly
        // We'll simulate this for now - in production, you'd need:
        // 1. WebSocket bridge server
        // 2. Chrome/Edge Web Serial API
        // 3. Node.js for desktop app
        
        this.useTCP = true;
        this.connected = true;
        
        logger.info('TCP mode enabled (simulation)');
        logger.warn('Note: For real TCP, use Web Serial API or WebSocket bridge');
        
        return true;
    }
    
    /**
     * Handle incoming notification
     */
    handleNotification(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);
        
        logger.debug('Received data:', text);
        
        // Accumulate response
        this.responseBuffer += text;
        
        // Check if response is complete (ends with '>' prompt)
        if (text.includes('>')) {
            const response = this.responseBuffer.trim();
            this.responseBuffer = '';
            
            if (this.responseCallback) {
                this.responseCallback(response);
                this.responseCallback = null;
            }
        }
    }
    
    /**
     * Send AT or OBD-II command to device and wait for response
     * 
     * @async
     * @param {string} command - AT command or OBD-II PID (e.g., 'ATZ', '010C')
     * @returns {Promise<string>} Response from device
     * @throws {Error} If not connected to device
     * @throws {Error} If command timeout (5 seconds)
     * 
     * @example
     * const response = await bluetooth.sendCommand('010C'); // Request RPM
     * console.log('Response:', response); // '41 0C 1A F8'
     */
    async sendCommand(command) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        logger.debug('Sending command:', command);
        
        if (this.useTCP) {
            // TCP simulation - return mock responses for testing
            return this.simulateResponse(command);
        }
        
        // Send via Bluetooth
        const encoder = new TextEncoder();
        const commandWithCR = command + '\r';
        const data = encoder.encode(commandWithCR);
        
        await this.characteristic.writeValue(data);
        
        // Wait for response
        return new Promise((resolve, reject) => {
            this.responseCallback = resolve;
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.responseCallback) {
                    this.responseCallback = null;
                    reject(new Error('Command timeout'));
                }
            }, 5000);
        });
    }
    
    /**
     * Simulate response for TCP/emulator testing
     */
    async simulateResponse(command) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        command = command.toUpperCase().trim();
        
        // Common AT commands
        if (command === 'ATZ') {
            return 'ELM327 v2.3';
        }
        if (command === 'ATE0' || command === 'ATL0' || command === 'ATH0') {
            return 'OK';
        }
        if (command === 'ATSP0') {
            return 'OK';
        }
        
        // Supported PIDs
        if (command === '0100') {
            return '41 00 BE 1F A8 13';
        }
        
        // OBD PIDs with realistic values
        if (command === '010C') { // RPM
            const rpm = Math.floor(1000 + Math.random() * 2000);
            const a = Math.floor((rpm * 4) / 256);
            const b = (rpm * 4) % 256;
            return `41 0C ${a.toString(16).padStart(2, '0').toUpperCase()} ${b.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        if (command === '010D') { // Speed
            const speed = Math.floor(40 + Math.random() * 30);
            return `41 0D ${speed.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        if (command === '0105') { // Coolant temp
            const temp = 90; // Celsius; PID 05 encodes temperature as A - 40.
            const value = temp + 40;
            return `41 05 ${value.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        if (command === '0104') { // Engine load
            const load = Math.floor(30 + Math.random() * 20);
            const value = Math.floor((load * 255) / 100);
            return `41 04 ${value.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        if (command === '012F') { // Fuel level
            const fuel = 75;
            const value = Math.floor((fuel * 255) / 100);
            return `41 2F ${value.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        if (command === '0111') { // Throttle
            const throttle = Math.floor(20 + Math.random() * 15);
            const value = Math.floor((throttle * 255) / 100);
            return `41 11 ${value.toString(16).padStart(2, '0').toUpperCase()}`;
        }
        
        // DTCs
        if (command === '03') {
            return '43 00'; // No DTCs
        }
        
        // Unknown command
        return '?';
    }
    
    /**
     * Disconnect from Bluetooth device
     * 
     * Cleanly disconnects from the GATT server and resets connection state.
     * Safe to call even if not connected.
     * 
     * @async
     * @returns {Promise<void>}
     * 
     * @example
     * await bluetooth.disconnect();
     * console.log('Disconnected safely');
     */
    async disconnect() {
        logger.info('Disconnecting from Bluetooth device...');
        
        if (this.device && this.device.gatt.connected) {
            await this.device.gatt.disconnect();
        }
        
        this.device = null;
        this.server = null;
        this.characteristic = null;
        this.connected = false;
        this.useTCP = false;
        
        logger.info('Bluetooth disconnected');
    }
    
    /**
     * Check connection status
     */
    isConnected() {
        return this.connected;
    }
}

logger.debug('BluetoothManager module loaded');
