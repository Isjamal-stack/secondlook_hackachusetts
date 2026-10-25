/**
 * Chart Manager Module
 * Handles creation and updates of charts for historical data visualization
 */

export class ChartManager {
    constructor(storage) {
        this.storage = storage;
        this.charts = {};
        this.currentMetric = 'rpm';
        this.currentDateRange = 30; // days
    }
    
    /**
     * Initialize history chart
     */
    initHistoryChart() {
        const canvas = document.getElementById('historyChart');
        if (!canvas) {
            console.error('[ChartManager] History chart canvas not found');
            return;
        }
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('[ChartManager] Chart.js not loaded');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if any
        if (this.charts.history) {
            this.charts.history.destroy();
        }
        
        // Create new chart
        this.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: this.getMetricLabel(this.currentMetric),
                    data: [],
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.getMetricUnit(this.currentMetric)
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                }
            }
        });
        
        console.log('[ChartManager] History chart initialized');
    }
    
    /**
     * Update history chart with data
     */
    async updateHistoryChart(metric, dateRange) {
        this.currentMetric = metric;
        this.currentDateRange = dateRange;
        
        if (!this.charts.history) {
            this.initHistoryChart();
        }
        
        console.log(`[ChartManager] Updating chart: ${metric}, ${dateRange} days`);
        
        try {
            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            
            if (dateRange === 'all') {
                startDate.setFullYear(startDate.getFullYear() - 10); // 10 years back
            } else {
                startDate.setDate(startDate.getDate() - parseInt(dateRange));
            }
            
            // Get readings from storage
            const readings = await this.storage.getReadings(startDate, endDate);
            console.log(`[ChartManager] Loaded ${readings.length} readings`);
            
            if (readings.length === 0) {
                console.warn('[ChartManager] No data available for selected range');
                this.charts.history.data.labels = [];
                this.charts.history.data.datasets[0].data = [];
                this.charts.history.update();
                return { min: 0, max: 0, avg: 0 };
            }
            
            // Downsample data for better performance
            const sampledData = this.downsampleData(readings, metric, 500);
            
            // Prepare chart data
            const labels = sampledData.map(r => new Date(r.timestamp));
            const values = sampledData.map(r => r[metric] || 0);
            
            // Update chart
            this.charts.history.data.labels = labels;
            this.charts.history.data.datasets[0].label = this.getMetricLabel(metric);
            this.charts.history.data.datasets[0].data = values;
            this.charts.history.options.scales.y.title.text = this.getMetricUnit(metric);
            this.charts.history.update('none'); // No animation for better performance
            
            // Calculate statistics
            const stats = this.calculateStatistics(values);
            console.log('[ChartManager] Chart updated with stats:', stats);
            
            return stats;
            
        } catch (error) {
            console.error('[ChartManager] Failed to update chart:', error);
            return { min: 0, max: 0, avg: 0 };
        }
    }
    
    /**
     * Downsample data for better performance
     */
    downsampleData(readings, metric, maxPoints) {
        if (readings.length <= maxPoints) {
            return readings;
        }
        
        const step = Math.ceil(readings.length / maxPoints);
        const sampled = [];
        
        for (let i = 0; i < readings.length; i += step) {
            // Average the values in this bucket
            const bucket = readings.slice(i, i + step);
            const avgValue = bucket.reduce((sum, r) => sum + (r[metric] || 0), 0) / bucket.length;
            
            sampled.push({
                timestamp: bucket[Math.floor(bucket.length / 2)].timestamp,
                [metric]: Math.round(avgValue)
            });
        }
        
        console.log(`[ChartManager] Downsampled ${readings.length} → ${sampled.length} points`);
        return sampled;
    }
    
    /**
     * Calculate statistics for dataset
     */
    calculateStatistics(values) {
        if (values.length === 0) {
            return { min: 0, max: 0, avg: 0 };
        }
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        return {
            min: Math.round(min),
            max: Math.round(max),
            avg: Math.round(avg)
        };
    }
    
    /**
     * Get metric label
     */
    getMetricLabel(metric) {
        const labels = {
            rpm: 'Engine RPM',
            speed: 'Vehicle Speed',
            coolant_temp: 'Coolant Temperature',
            engine_load: 'Engine Load',
            fuel_level: 'Fuel Level',
            throttle_pos: 'Throttle Position'
        };
        return labels[metric] || metric;
    }
    
    /**
     * Get metric unit
     */
    getMetricUnit(metric) {
        const units = {
            rpm: 'RPM',
            speed: 'MPH',
            coolant_temp: '°F',
            engine_load: '%',
            fuel_level: '%',
            throttle_pos: '%'
        };
        return units[metric] || '';
    }
    
    /**
     * Destroy all charts
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

console.log('[ChartManager] Module loaded');
