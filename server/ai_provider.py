"""
AI Provider Integration
Handles AI model requests for explanation generation
"""

import os
import json
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
                    "content": """You are a helpful assistant that explains vehicle diagnostic readings to drivers with limited mechanical knowledge.

    Your explanations should:
    - Use plain, friendly language
    - Explain what the readings mean and why they matter
    - Avoid technical jargon
    - Be concise (2-3 sentences)
    - Match the urgency level provided
    - NOT claim to diagnose specific failed components
    - NOT override the provided next step
    - NOT invent confidence percentages or measurements
    - Explain only the observed window; do not infer coolant circulation or overall vehicle health
    - These are time-compressed simulated readings and prototype rules, not vehicle-specific limits
    - Explain the pattern only; keep advice within the supplied approved next step

    You will receive evidence with observed values and you must explain the pattern honestly."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=200
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
    """Build a prompt from the analysis event"""
    condition = event.get('condition', 'unknown')
    urgency = event.get('urgency', 'unknown')
    evidence = event.get('evidence', [])

    prompt_parts = [
        f"Condition: {condition}",
        f"Urgency level: {urgency}",
        "Context: Time-compressed simulation using prototype rules, not calibrated vehicle limits.",
        f"Approved next step: {event.get('approved_next_step', 'Wait for more readings.')}",
        "Limitations: " + ' '.join(event.get('limitations') or ['The mechanical cause is unknown.']),
        "",
        "Evidence:"
    ]

    for item in evidence:
        metric = item.get('metric', 'unknown')
        start = item.get('start_value')
        end = item.get('end_value')
        duration = item.get('duration_s')

        metric_name = {
            'coolant_c': 'coolant temperature',
            'rpm': 'engine RPM',
            'speed_kmh': 'vehicle speed',
            'engine_load_pct': 'engine load'
        }.get(metric, metric)
        unit = {'coolant_c': '°C', 'rpm': 'RPM', 'speed_kmh': 'km/h', 'engine_load_pct': '%'}.get(metric, '')

        if start is not None and end is not None:
            prompt_parts.append(f"- {metric_name}: {start} → {end} {unit} over {duration}s")
        elif end is not None:
            prompt_parts.append(f"- {metric_name}: {end} {unit}")

    prompt_parts.extend([
        "",
        "Explain this pattern to a driver who wants to understand what's happening and why it matters. Be honest about what we can and cannot determine from these readings alone. Keep it to 2-3 sentences."
    ])

    return "\n".join(prompt_parts)


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
            return 'Readings appear normal'
    else:
        return 'Vehicle readings summary'
