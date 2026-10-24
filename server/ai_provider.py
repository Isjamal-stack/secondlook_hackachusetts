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
    - Do NOT claim a normal/typical/safe operating range, normal warm-up, working cooling components, or a healthy car
    - A steady window establishes only steady temperature, not warming up or effective cooling
    - Do not include numbers, measurements, thresholds, or advice in your prose; the interface supplies exact evidence and the approved action

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
        "Return exactly two short sentences. First describe only the observed direction (steady, rising, or falling) in this window. Then explain that the readings cannot establish the mechanical cause or overall vehicle condition. Do not repeat any numbers or units; the interface already displays the exact numeric evidence. Do not add driving advice, performance claims, component operation, damage predictions, or normal/typical temperature ranges."
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
            return 'Observed reading pattern'
    else:
        return 'Vehicle readings summary'


def explanation_is_grounded(explanation, event):
    """Conservative demo guard for known unsupported wording, not a fact checker.

    Numeric evidence stays deterministic; AI supplies only a short qualitative gloss.
    Reject rather than try to rewrite questionable prose.
    """
    text = ' '.join(explanation.get(key, '') for key in ('title', 'explanation')).lower()
    # Reject all generated numbers, including confidence/measurements and spelled values.
    if re.search(r'\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|percent|degrees)\b', text):
        return False
    unsupported = (
        r'\b(?:normal|typical|expected|safe|healthy|healthier|normally|effective|effectively|properly|optimal|overheat\w*)\b',
        r'\b(?:cooling system|coolant|radiator|thermostat|water pump|fan)\b.{0,60}\b(?:working|functioning|managing|circulating|operating)\b',
        r'\b(?:working|functioning|managing|circulating)\b.{0,60}\b(?:cooling|coolant|radiator|thermostat|pump|fan)\b',
        r'\b(?:car|vehicle|engine)\b.{0,35}\b(?:fine|good condition|no (?:issues|problems)|all (?:good|clear))\b',
        r'\b(?:replace|repair|refill|flush|pull over|stop driving|keep driving|continue driving)\b',
    )
    if any(re.search(pattern, text) for pattern in unsupported):
        return False
    # The actual problematic stable-window response inferred warm-up from 90 -> 90.
    coolant = [item for item in event['evidence'] if item['metric'] == 'coolant_c']
    if coolant and all(item['start_value'] == item['end_value'] for item in coolant):
        if re.search(r'\b(?:warming|warms|heating|hotter|rising|increasing|cooling down|falling|dropping)\b', text):
            return False
    return True
