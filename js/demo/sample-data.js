/**
 * Sample Data Generator Module
 * Generates realistic OBD-II data for development and testing
 */

import logger from '../utils/logger.js';

export class SampleDataGenerator {
    constructor() {
        this.scenarios = {
            city: {
                avgSpeed: 25,
                maxSpeed: 45,
                avgRPM: 2000,
                maxRPM: 3500,
                stopProbability: 0.3
            },
            highway: {
                avgSpeed: 65,
                maxSpeed: 75,
                avgRPM: 2500,
                maxRPM: 3000,
                stopProbability: 0.05
            },
            mixed: {
                avgSpeed: 40,
                maxSpeed: 65,
                avgRPM: 2200,
                maxRPM: 4000,
                stopProbability: 0.15
            }
        };
        
        // DTC codes with descriptions
        this.dtcCodes = [
            { code: 'P0300', description: 'Random/Multiple Cylinder Misfire Detected', severity: 'high' },
            { code: 'P0301', description: 'Cylinder 1 Misfire Detected', severity: 'high' },
            { code: 'P0420', description: 'Catalyst System Efficiency Below Threshold', severity: 'medium' },
            { code: 'P0171', description: 'System Too Lean (Bank 1)', severity: 'medium' },
            { code: 'P0128', description: 'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)', severity: 'low' }
        ];
    }
    
    /**
     * Generate sample data for specified number of days
     */
    generateData(days = 30) {
        logger.info(`Generating ${days} days of sample data...`);
        
        const data = {
            vehicle: this.generateVehicleProfile(),
            trips: [],
            readings: [],
            maintenance: [],
            dtcHistory: []
        };
        
        const now = new Date();
        const tripsPerDay = this.randomInt(1, 3);
        
        // Generate trips going backwards in time
        for (let day = 0; day < days; day++) {
            const dayDate = new Date(now);
            dayDate.setDate(dayDate.getDate() - day);
            
            const numTrips = this.randomInt(1, tripsPerDay);
            
            for (let tripNum = 0; tripNum < numTrips; tripNum++) {
                // Randomize trip time during the day
                const tripHour = tripNum === 0 ? this.randomInt(7, 9) : this.randomInt(16, 19);
                const tripDate = new Date(dayDate);
                tripDate.setHours(tripHour, this.randomInt(0, 59), 0, 0);
                
                const scenario = this.getRandomScenario();
                const trip = this.generateTrip(scenario, tripDate);
                
                data.trips.push(trip.tripData);
                data.readings.push(...trip.readings);
            }
        }
        
        // Generate maintenance records
        data.maintenance = this.generateMaintenanceRecords(days);
        
        // Occasionally add DTCs
        if (Math.random() < 0.2) {
            data.dtcHistory = this.generateDTCHistory(days);
        }
        
        logger.info('Generated sample data:', {
            trips: data.trips.length,
            readings: data.readings.length,
            maintenance: data.maintenance.length,
            dtcs: data.dtcHistory.length
        });
        
        return data;
    }
    
    /**
     * Generate a realistic vehicle profile
     */
    generateVehicleProfile() {
        const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan'];
        const models = {
            'Toyota': ['Camry', 'Corolla', 'RAV4', 'Prius'],
            'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot'],
            'Ford': ['F-150', 'Escape', 'Explorer', 'Mustang'],
            'Chevrolet': ['Silverado', 'Equinox', 'Malibu', 'Cruze'],
            'Nissan': ['Altima', 'Rogue', 'Sentra', 'Pathfinder']
        };
        
        const make = makes[Math.floor(Math.random() * makes.length)];
        const model = models[make][Math.floor(Math.random() * models[make].length)];
        const year = this.randomInt(2015, 2024);
        
        return {
            id: 'vehicle_1',
            vin: this.generateVIN(),
            make,
            model,
            year,
            fuel_type: Math.random() < 0.1 ? 'Hybrid' : 'Gasoline',
            odometer: this.randomInt(20000, 100000),
            odometer_unit: 'miles'
        };
    }
    
    /**
     * Generate a single trip
     */
    generateTrip(scenario = 'mixed', startTime = new Date()) {
        const scenarioConfig = this.scenarios[scenario];
        const tripId = `trip_${startTime.getTime()}`;
        
        // Trip duration: 10-60 minutes
        const durationMinutes = this.randomInt(10, 60);
        const durationSeconds = durationMinutes * 60;
        
        const readings = [];
        let currentSpeed = 0;
        let currentRPM = 800; // Idle RPM
        let coolantTemp = 70; // Starting cold
        let fuelLevel = this.randomInt(30, 90);
        let distance = 0;
        
        // Statistics for trip summary
        const stats = {
            speeds: [],
            rpms: [],
            hardAccelerations: 0,
            hardBrakes: 0,
            idleTime: 0,
            fuelConsumed: 0
        };
        
        // Generate reading every second
        for (let second = 0; second < durationSeconds; second++) {
            const timestamp = new Date(startTime.getTime() + second * 1000);
            const progress = second / durationSeconds;
            
            // Warm up engine temperature gradually
            if (coolantTemp < 195) {
                coolantTemp += this.randomFloat(0.5, 1.5);
                coolantTemp = Math.min(coolantTemp, 195);
            }
            
            // Simulate driving behavior
            const isStop = Math.random() < scenarioConfig.stopProbability;
            
            if (isStop) {
                // Stopping or idling
                const deceleration = this.randomInt(5, 15);
                currentSpeed = Math.max(0, currentSpeed - deceleration);
                currentRPM = currentSpeed === 0 ? this.randomInt(700, 900) : this.randomInt(1500, 2000);
                
                if (currentSpeed === 0) {
                    stats.idleTime += 1;
                }
                
                if (deceleration > 10) {
                    stats.hardBrakes++;
                }
            } else {
                // Accelerating or maintaining speed
                const targetSpeed = this.randomInt(
                    Math.max(0, scenarioConfig.avgSpeed - 10),
                    scenarioConfig.maxSpeed
                );
                
                if (currentSpeed < targetSpeed) {
                    const acceleration = this.randomInt(2, 10);
                    currentSpeed = Math.min(targetSpeed, currentSpeed + acceleration);
                    
                    if (acceleration > 7) {
                        stats.hardAccelerations++;
                    }
                }
                
                // RPM follows speed
                if (currentSpeed > 0) {
                    const gearRatio = currentSpeed < 20 ? 3.5 : currentSpeed < 40 ? 2.5 : currentSpeed < 60 ? 1.8 : 1.2;
                    currentRPM = Math.min(scenarioConfig.maxRPM, 800 + (currentSpeed * gearRatio * 40));
                    currentRPM += this.randomInt(-100, 100); // Add noise
                }
            }
            
            // Calculate other metrics
            const throttlePos = currentSpeed === 0 ? 0 : this.randomInt(15, 45);
            const engineLoad = Math.min(100, (currentRPM / 6000) * 100 + (throttlePos / 2));
            
            // Fuel consumption (very simplified)
            if (currentSpeed > 0) {
                const fuelRate = (currentRPM / 100000) * (throttlePos / 100);
                stats.fuelConsumed += fuelRate;
                fuelLevel = Math.max(0, fuelLevel - (fuelRate / 100));
            }
            
            // Distance traveled
            distance += (currentSpeed / 3600); // mph to miles per second
            
            // Store reading
            const reading = {
                timestamp: timestamp.toISOString(),
                trip_id: tripId,
                rpm: Math.round(currentRPM),
                speed: Math.round(currentSpeed),
                coolant_temp: Math.round(coolantTemp),
                engine_load: Math.round(engineLoad),
                fuel_level: Math.round(fuelLevel),
                throttle_pos: Math.round(throttlePos),
                intake_temp: Math.round(coolantTemp - this.randomInt(30, 50)),
                maf: this.randomFloat(2, 8)
            };
            
            readings.push(reading);
            stats.speeds.push(currentSpeed);
            stats.rpms.push(currentRPM);
        }
        
        // Calculate trip statistics
        const avgSpeed = stats.speeds.reduce((a, b) => a + b, 0) / stats.speeds.length;
        const maxSpeed = Math.max(...stats.speeds);
        const avgRPM = stats.rpms.reduce((a, b) => a + b, 0) / stats.rpms.length;
        const maxRPM = Math.max(...stats.rpms);
        
        // Calculate MPG (simplified)
        const avgMPG = stats.fuelConsumed > 0 ? distance / stats.fuelConsumed : 30;
        
        const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
        
        const tripData = {
            id: tripId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            scenario,
            distance: parseFloat(distance.toFixed(2)),
            duration: durationSeconds,
            avg_speed: parseFloat(avgSpeed.toFixed(1)),
            max_speed: Math.round(maxSpeed),
            avg_rpm: Math.round(avgRPM),
            max_rpm: Math.round(maxRPM),
            avg_mpg: parseFloat(avgMPG.toFixed(1)),
            hard_accelerations: stats.hardAccelerations,
            hard_brakes: stats.hardBrakes,
            idle_time: stats.idleTime
        };
        
        return { tripData, readings };
    }
    
    /**
     * Generate maintenance records
     */
    generateMaintenanceRecords(days) {
        const records = [];
        const now = new Date();
        
        // Oil change every ~5000 miles (roughly every 6 months)
        if (days >= 180) {
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
            
            records.push({
                id: `maint_${Date.now()}_1`,
                date: sixMonthsAgo.toISOString(),
                type: 'oil_change',
                description: 'Oil and filter change',
                odometer: this.randomInt(75000, 85000),
                cost: this.randomFloat(40, 60),
                location: 'Quick Lube'
            });
        }
        
        // Tire rotation
        if (days >= 120) {
            const fourMonthsAgo = new Date(now);
            fourMonthsAgo.setDate(fourMonthsAgo.getDate() - 120);
            
            records.push({
                id: `maint_${Date.now()}_2`,
                date: fourMonthsAgo.toISOString(),
                type: 'tire_rotation',
                description: 'Tire rotation and balance',
                odometer: this.randomInt(70000, 80000),
                cost: this.randomFloat(25, 45),
                location: 'Tire Shop'
            });
        }
        
        return records;
    }
    
    /**
     * Generate DTC history
     */
    generateDTCHistory(days) {
        const history = [];
        const now = new Date();
        
        // 20% chance of historical DTC
        if (Math.random() < 0.2) {
            const dtc = this.dtcCodes[Math.floor(Math.random() * this.dtcCodes.length)];
            const daysAgo = this.randomInt(5, days);
            const detectedDate = new Date(now);
            detectedDate.setDate(detectedDate.getDate() - daysAgo);
            
            const clearedDate = new Date(detectedDate);
            clearedDate.setDate(clearedDate.getDate() + this.randomInt(1, 5));
            
            history.push({
                code: dtc.code,
                description: dtc.description,
                category: 'Powertrain',
                severity: dtc.severity,
                detected_at: detectedDate.toISOString(),
                cleared_at: clearedDate.toISOString(),
                odometer: this.randomInt(70000, 90000)
            });
        }
        
        return history;
    }
    
    /**
     * Get random scenario
     */
    getRandomScenario() {
        const scenarios = Object.keys(this.scenarios);
        return scenarios[Math.floor(Math.random() * scenarios.length)];
    }
    
    /**
     * Generate realistic VIN
     */
    generateVIN() {
        const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
        let vin = '';
        for (let i = 0; i < 17; i++) {
            vin += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return vin;
    }
    
    /**
     * Random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * Random float between min and max
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }
}

logger.debug('SampleDataGenerator module loaded');
