# Data Import/Export File Format Specification

This document describes the file formats supported for importing and exporting OBD-II vehicle data.

## Supported Formats

The application supports two file formats for data import/export:
1. **CSV** - Simple, human-readable format
2. **JSON** - Complete data format with metadata

## CSV Format

### Structure

CSV files should contain OBD-II sensor readings with timestamps. The first row must contain column headers.

### Required Columns
- `timestamp` - ISO 8601 format (e.g., 2024-01-15T10:30:00Z)
- At least one data column

### Supported Data Columns
- `rpm` - Engine RPM (revolutions per minute)
- `speed` - Vehicle speed (mph or km/h based on settings)
- `coolant_temp` - Engine coolant temperature (°F or °C)
- `engine_load` - Engine load percentage (0-100)
- `fuel_level` - Fuel level percentage (0-100)
- `throttle_pos` - Throttle position percentage (0-100)
- `intake_temp` - Intake air temperature
- `maf` - Mass air flow rate (g/s)

### Example CSV

```csv
timestamp,rpm,speed,coolant_temp,engine_load,fuel_level,throttle_pos
2024-01-15T10:30:00Z,2500,45,195,35,75,25
2024-01-15T10:30:01Z,2550,46,195,36,75,26
2024-01-15T10:30:02Z,2600,47,196,37,75,27
2024-01-15T10:30:03Z,2650,48,196,38,75,28
```

### CSV Import Notes
- Timestamps must be in ISO 8601 format
- Missing values should be left empty (consecutive commas)
- Values should be numeric (except timestamp)
- File encoding should be UTF-8
- Maximum recommended file size: 50MB

## JSON Format

### Structure

JSON files provide a complete data export including vehicle profile, readings, trips, maintenance history, and diagnostic codes.

### Top-Level Schema

```json
{
  "version": "1.0",
  "exported_at": "2024-01-15T10:30:00Z",
  "vehicle": { ... },
  "readings": [ ... ],
  "trips": [ ... ],
  "maintenance": [ ... ],
  "dtc_history": [ ... ]
}
```

### Vehicle Profile

```json
"vehicle": {
  "vin": "1HGBH41JXMN109186",
  "make": "Toyota",
  "model": "Auris Hybrid",
  "year": 2015,
  "fuel_type": "Hybrid",
  "odometer": 85000,
  "odometer_unit": "miles"
}
```

### Readings Array

```json
"readings": [
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "trip_id": "trip_123",
    "rpm": 2500,
    "speed": 45,
    "coolant_temp": 195,
    "engine_load": 35,
    "fuel_level": 75,
    "throttle_pos": 25,
    "intake_temp": 70,
    "maf": 5.2
  }
]
```

### Trips Array

```json
"trips": [
  {
    "id": "trip_123",
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T10:45:00Z",
    "distance": 25.3,
    "duration": 2700,
    "avg_speed": 33.7,
    "avg_rpm": 2200,
    "avg_mpg": 32.4,
    "max_speed": 65,
    "max_rpm": 4500,
    "hard_accelerations": 2,
    "hard_brakes": 1,
    "idle_time": 180
  }
]
```

### Maintenance Records

```json
"maintenance": [
  {
    "id": "maint_001",
    "date": "2024-01-01T00:00:00Z",
    "odometer": 80000,
    "type": "oil_change",
    "description": "Oil and filter change",
    "cost": 45.00,
    "location": "Quick Lube"
  }
]
```

### DTC History

```json
"dtc_history": [
  {
    "code": "P0301",
    "description": "Cylinder 1 Misfire Detected",
    "category": "Powertrain",
    "severity": "high",
    "detected_at": "2024-01-10T15:30:00Z",
    "cleared_at": "2024-01-12T09:00:00Z",
    "odometer": 84500
  }
]
```

### Complete JSON Example

```json
{
  "version": "1.0",
  "exported_at": "2024-01-15T10:30:00Z",
  "vehicle": {
    "vin": "1HGBH41JXMN109186",
    "make": "Toyota",
    "model": "Auris Hybrid",
    "year": 2015,
    "fuel_type": "Hybrid",
    "odometer": 85000,
    "odometer_unit": "miles"
  },
  "readings": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "trip_id": "trip_123",
      "rpm": 2500,
      "speed": 45,
      "coolant_temp": 195,
      "engine_load": 35,
      "fuel_level": 75,
      "throttle_pos": 25
    }
  ],
  "trips": [
    {
      "id": "trip_123",
      "start_time": "2024-01-15T10:00:00Z",
      "end_time": "2024-01-15T10:45:00Z",
      "distance": 25.3,
      "avg_mpg": 32.4
    }
  ],
  "maintenance": [],
  "dtc_history": []
}
```

## Import Process

1. **File Selection**: User selects CSV or JSON file
2. **Validation**: Application validates file structure
3. **Parsing**: Data is parsed and converted to internal format
4. **Deduplication**: Duplicate timestamps are detected and skipped
5. **Merge**: New data is merged with existing database
6. **Confirmation**: User sees import summary (records added, duplicates skipped)

## Export Process

1. **Format Selection**: User chooses CSV or JSON
2. **Date Range**: Optional filter by date range
3. **Generation**: Application queries IndexedDB and generates file
4. **Download**: Browser downloads the file

## Data Validation Rules

### Timestamps
- Must be valid ISO 8601 format
- Must not be in the future
- Should be chronologically ordered (warning if not)

### Numeric Values
- RPM: 0-8000 (warning if outside typical range)
- Speed: 0-200 mph
- Coolant Temp: 0-300°F
- Engine Load: 0-100%
- Fuel Level: 0-100%
- Throttle Position: 0-100%

### String Values
- VIN: 17 characters alphanumeric
- Make/Model: Max 50 characters
- Year: 1900-2100

## Error Handling

### Invalid File Format
```json
{
  "error": "Invalid file format",
  "message": "File must be CSV or JSON",
  "code": "INVALID_FORMAT"
}
```

### Parse Error
```json
{
  "error": "Parse error",
  "message": "Invalid CSV structure at line 5",
  "code": "PARSE_ERROR",
  "line": 5
}
```

### Validation Error
```json
{
  "error": "Validation error",
  "message": "RPM value 15000 exceeds maximum",
  "code": "VALIDATION_ERROR",
  "field": "rpm",
  "value": 15000
}
```

## Best Practices

### For CSV Files
- Include only data you need (reduces file size)
- Use consistent units throughout file
- Include timestamp for every reading
- Sort chronologically

### For JSON Files
- Use JSON export for complete backup
- Include all sections for full restore capability
- Validate JSON structure before import
- Compress large files before sharing

### File Size Limits
- CSV: Recommended max 50MB
- JSON: Recommended max 100MB
- Larger files may take longer to import
- Consider splitting large datasets by date range

## Example Use Cases

### Backup All Data
1. Go to Settings → Data Management
2. Click "Export Data"
3. Choose JSON format
4. Select "All Time" date range
5. Download complete backup

### Share Trip Data
1. Go to History
2. Select specific trip
3. Click "Export Trip"
4. Choose CSV format
5. Share file with mechanic/friend

### Import from Another App
1. Export data from other OBD app
2. Convert to CSV format (if needed)
3. Ensure column names match specification
4. Import via Upload Data feature
5. Verify data appears correctly

## Version History

- **v1.0** (2024-10-24): Initial format specification
  - CSV support with 8 standard PIDs
  - JSON support with full data model
  - Validation rules defined

## Future Enhancements

Planned additions to file format:
- Support for custom PIDs
- GPS location data
- Weather conditions
- Fuel prices and costs
- Photos/attachments for maintenance records
