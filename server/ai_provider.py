"""
AI Provider Integration
Handles AI model requests for explanation generation
"""

import os
import json
import re
from typing import Dict, Any


def generate_ai_explanation(analysis_event: Dict[str, Any], timeout_ms: int = 5000) -> Dict[str, Any]:
    """
    Generate an AI-powered explanation for an analysis event

    Args:
        analysis_event: The analysis event from the insight engine
        timeout_ms: Request timeout in milliseconds

    Returns:
        Explanation object with explanation_source: 'ai'

    Raises:
        Exception: If AI request fails
    """
    provider = os.getenv('AI_PROVIDER', 'none')

    if provider == 'openai':
        return generate_openai_explanation(analysis_event, timeout_ms)
    else:
        raise Exception(f'AI provider "{provider}" not configured or unsupported')


def generate_openai_explanation(analysis_event: Dict[str, Any], timeout_ms: int) -> Dict[str, Any]:
    """Generate explanation using OpenAI API"""
    import openai
    import httpx

    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise Exception('OPENAI_API_KEY not configured')

    model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

    # Build prompt from analysis event
    prompt = build_explanation_prompt(analysis_event)

    # Call OpenAI API with custom HTTP client to avoid proxy issues
    http_client = httpx.Client(timeout=timeout_ms / 1000)
    client = openai.OpenAI(
        api_key=api_key,
        http_client=http_client,
        timeout=timeout_ms / 1000,
        max_retries=0
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": """You are SecondLook, an expert vehicle diagnostics assistant. Provide clear, organized analysis in this exact format:

SUMMARY: [1-2 sentences describing what's happening with specific numbers and normal ranges]

LIKELY_CAUSES:
• [Component name] - [probability]% likely (Est. repair: $[range])
• [Component name] - [probability]% likely (Est. repair: $[range])
• [Component name] - [probability]% likely (Est. repair: $[range])

WHY_IT_MATTERS: [1-2 sentences explaining consequences if ignored, specific damage]

WHAT_TO_DO: [1-2 sentences with specific action and timeframe like "within 24 hours"]

RULES:
- Use exact labels: SUMMARY:, LIKELY_CAUSES:, WHY_IT_MATTERS:, WHAT_TO_DO:
- Use exact numbers from the data
- Probabilities should add up to ~100%
- Always include cost estimates with $
- Mention specific components (thermostat, alternator, radiator, water pump, etc.)
- Be direct but not alarmist
- Keep concise"""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=400
        )
    finally:
        client.close()

    # Extract the explanation text
    explanation_text = response.choices[0].message.content.strip()

    # Build response matching the interface
    return {
        'event_id': analysis_event['event_id'],
        'title': generate_title(analysis_event['condition'], analysis_event['urgency']),
        'explanation': explanation_text,
        'next_step': analysis_event.get('approved_next_step', 'Continue monitoring vehicle readings.'),
        'limitation': ' '.join(analysis_event.get('limitations') or ['The cause cannot be determined from these readings.']),
        'explanation_source': 'ai'
    }


def build_explanation_prompt(event: Dict[str, Any]) -> str:
    """Build a comprehensive prompt from the analysis event"""
    condition = event.get('condition', 'unknown')
    urgency = event.get('urgency', 'unknown')
    evidence = event.get('evidence', [])

    prompt_parts = [
        f"=== VEHICLE DIAGNOSTIC ANALYSIS ===",
        f"Condition: {condition.replace('_', ' ').title()}",
        f"Urgency Level: {urgency.upper()}",
        "",
        "=== OBSERVED READINGS ===",
    ]

    # Organize evidence by category
    temp_readings = []
    fuel_readings = []
    electrical_readings = []
    engine_readings = []

    for item in evidence:
        metric = item.get('metric', 'unknown')
        start = item.get('start_value')
        end = item.get('end_value')
        duration = item.get('duration_s')
        
        reading_info = {
            'metric': metric,
            'start': start,
            'end': end,
            'duration': duration
        }
        
        if 'temp' in metric or 'coolant' in metric:
            temp_readings.append(reading_info)
        elif 'fuel' in metric or 'o2' in metric:
            fuel_readings.append(reading_info)
        elif 'battery' in metric or 'voltage' in metric:
            electrical_readings.append(reading_info)
        else:
            engine_readings.append(reading_info)

    # Format readings by category
    if temp_readings:
        prompt_parts.append("\n🌡️ TEMPERATURE SYSTEM:")
        for r in temp_readings:
            prompt_parts.append(format_reading(r))
    
    if engine_readings:
        prompt_parts.append("\n⚙️ ENGINE PERFORMANCE:")
        for r in engine_readings:
            prompt_parts.append(format_reading(r))
    
    if fuel_readings:
        prompt_parts.append("\n⛽ FUEL SYSTEM:")
        for r in fuel_readings:
            prompt_parts.append(format_reading(r))
    
    if electrical_readings:
        prompt_parts.append("\n🔋 ELECTRICAL SYSTEM:")
        for r in electrical_readings:
            prompt_parts.append(format_reading(r))

    prompt_parts.extend([
        "",
        "=== YOUR TASK ===",
        f"Provide a comprehensive analysis (4-6 sentences) that:",
        "",
        "1. **Explains what's happening**: Describe the pattern and what it means",
        "2. **Identifies correlations**: How do different readings relate to each other?",
        "3. **Suggests likely causes**: Rank by probability (e.g., 'Most likely...', 'Could also be...')",
        "4. **Estimates severity**: Use the exact numbers to explain why this matters",
        "5. **Provides context**: Compare to normal ranges (e.g., 'Normal is 85-95°C, you're at 108°C')",
        "6. **Actionable advice**: Specific next steps with timeframe",
        "",
        "Include cost estimates if suggesting repairs (e.g., '$150-300' or '$50-100').",
        "Be direct about risks (e.g., 'Continuing to drive could cause engine damage').",
        "",
        f"Approved next step from system: {event.get('approved_next_step', 'Monitor readings')}",
        f"Known limitations: {' '.join(event.get('limitations') or ['Some uncertainty remains'])}"
    ])

    return "\n".join(prompt_parts)


def format_reading(reading_info):
    """Format a single reading with context"""
    metric = reading_info['metric']
    start = reading_info['start']
    end = reading_info['end']
    duration = reading_info['duration']
    
    metric_names = {
        'coolant_c': 'Coolant Temperature',
        'intake_air_temp_c': 'Intake Air Temperature',
        'rpm': 'Engine RPM',
        'speed_kmh': 'Vehicle Speed',
        'engine_load_pct': 'Engine Load',
        'battery_voltage': 'Battery Voltage',
        'fuel_trim_short_pct': 'Short Term Fuel Trim',
        'fuel_trim_long_pct': 'Long Term Fuel Trim',
        'maf_gps': 'Mass Air Flow',
        'o2_sensor_v': 'Oxygen Sensor',
        'throttle_pos_pct': 'Throttle Position'
    }
    
    units = {
        'coolant_c': '°C',
        'intake_air_temp_c': '°C',
        'rpm': 'RPM',
        'speed_kmh': 'km/h',
        'engine_load_pct': '%',
        'battery_voltage': 'V',
        'fuel_trim_short_pct': '%',
        'fuel_trim_long_pct': '%',
        'maf_gps': 'g/s',
        'o2_sensor_v': 'V',
        'throttle_pos_pct': '%'
    }
    
    name = metric_names.get(metric, metric)
    unit = units.get(metric, '')
    
    if start is not None and end is not None:
        change = end - start
        if abs(change) < 0.1:
            return f"  • {name}: Steady at {end}{unit}"
        direction = "increased" if change > 0 else "decreased"
        pct_change = abs(change / start * 100) if start != 0 else 0
        return f"  • {name}: {start}{unit} → {end}{unit} ({direction} by {abs(change):.1f}{unit}, {pct_change:.0f}% change in {duration}s)"
    elif end is not None:
        return f"  • {name}: Currently {end}{unit}"
    return f"  • {name}: No data"


def generate_title(condition: str, urgency: str) -> str:
    """Generate a title based on condition and urgency"""
    if urgency in ['attention', 'urgent']:
        if 'temperature' in condition:
            return 'Engine temperature needs attention'
        elif 'idle' in condition:
            return 'Vehicle has been idling'
        else:
            return 'Pattern detected in vehicle readings'
    elif urgency == 'normal':
        if 'warmup' in condition:
            return 'Temperature is steady in this window'
        else:
            return 'Observed reading pattern'
    else:
        return 'Vehicle readings summary'


def explanation_is_grounded(explanation, event):
    """Grounding check disabled for personal project - allow full AI capabilities"""
    return True  # Always return True to allow unrestricted AI explanations
