# UI Directory

This directory contains user interface components and presentation logic.

## Files

### `chart-manager.js`
**Purpose**: Chart.js wrapper for data visualization

**Responsibilities**:
- Initialize and manage Chart.js instances
- Update charts with real-time data
- Handle chart configuration
- Manage chart lifecycle (create, update, destroy)
- Downsample data for performance
- Support multiple chart types

**Supported Charts**:
- Line charts for time-series data
- Scatter plots for data points
- Real-time updating charts

**Key Methods**:
- `createChart(elementId, config)` - Create new chart instance
- `updateChart(chartId, data)` - Update chart with new data
- `destroyChart(chartId)` - Clean up chart instance
- `downsampleData(readings, metric, maxPoints)` - Reduce data points for performance

**Dependencies**: Chart.js (loaded via CDN in HTML)

---

## Usage Example

### Basic Chart Usage
```javascript
import { ChartManager } from './ui/chart-manager.js';

const chartManager = new ChartManager();

// Create chart
const chart = chartManager.createChart('myChart', {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'RPM',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
        }]
    },
    options: {
        responsive: true,
        animation: false
    }
});

// Update chart with new data
chartManager.updateChart(chart.id, {
    labels: timestamps,
    data: values
});
```

---

## Design Patterns

### Manager Pattern
ChartManager centralizes chart operations:
- Single source of truth for charts
- Consistent API for all chart operations
- Lifecycle management
- Memory cleanup

### Configuration Pattern
Charts are configured through options objects:
- Flexible and extensible
- Type-safe with TypeScript (future)
- Easy to customize

---

## Performance Considerations

### Data Downsampling
For large datasets (>500 points), the chart manager downsamples data:
- Reduces render time
- Maintains visual accuracy
- Averages values within buckets
- Configurable max points

### Animation Control
Charts use `animation: false` for real-time updates:
- Smoother updates
- Better performance
- No visual lag

### Memory Management
Charts are destroyed when no longer needed:
- Prevents memory leaks
- Releases Canvas context
- Cleans up event listeners

---

## Future Enhancements

### Additional Components
- [ ] Data table component
- [ ] Gauge component for metrics
- [ ] Alert/notification system
- [ ] Modal dialogs
- [ ] Form validation helpers

### Chart Enhancements
- [ ] Export chart as image
- [ ] Zoom and pan controls
- [ ] Multiple Y-axes support
- [ ] Real-time streaming mode
- [ ] Custom tooltips
- [ ] Annotation support

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode
- [ ] ARIA labels
- [ ] Focus management

### Responsive Design
- [ ] Mobile-optimized charts
- [ ] Touch gestures
- [ ] Adaptive layouts
- [ ] Portrait/landscape handling

---

## Component Guidelines

When adding new UI components:

1. **Single Responsibility**: Each component should do one thing well
2. **Reusability**: Design for reuse across features
3. **Configuration**: Use options objects for flexibility
4. **Events**: Emit events for state changes
5. **Cleanup**: Implement destroy/cleanup methods
6. **Documentation**: Add JSDoc comments
7. **Examples**: Include usage examples

### Example Component Structure
```javascript
export class MyComponent {
    constructor(elementId, options = {}) {
        this.element = document.getElementById(elementId);
        this.options = { ...defaultOptions, ...options };
        this.initialize();
    }
    
    initialize() {
        // Setup component
    }
    
    update(data) {
        // Update component
    }
    
    destroy() {
        // Cleanup resources
    }
}
```

---

## Testing UI Components

### Unit Testing
- Mock DOM elements
- Test component methods
- Verify state changes
- Test event emissions

### Integration Testing
- Test component interactions
- Verify data flow
- Test error handling

### Visual Testing
- Screenshot comparison
- Cross-browser testing
- Responsive design testing
- Accessibility testing

---

**Last Updated**: October 24, 2026  
**Maintainer**: SecondLook Team
