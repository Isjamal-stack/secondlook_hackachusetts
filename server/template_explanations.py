"""
Template Explanations
Fallback explanations when AI service is unavailable
"""

TEMPLATE_EXPLANATIONS = {
    'normal_warmup': {
        'title': 'Temperature is steady in this window',
        'explanation': 'Coolant temperature stayed steady during the observed window and matched our demo’s stable-temperature rule. This does not establish the condition of the whole car.',
        'limitation': 'These readings show the warm-up process but cannot verify all cooling system components are functioning properly.'
    },
    
    'sustained_temperature_rise': {
        'title': 'Coolant temperature is continuing to rise',
        'explanation': 'Coolant temperature rose during the observed window, triggering our demo’s temperature-rise rule. These readings do not identify the mechanical cause or establish a normal temperature limit for your car.',
        'limitation': 'These readings do not identify the specific failed component or root cause.'
    },
    
    'prolonged_idling': {
        'title': 'Vehicle has been idling for an extended period',
        'explanation': 'Your engine has been running while stationary for a sustained period. Extended idling can waste fuel and may cause engine components to wear differently than during normal driving.',
        'limitation': 'These readings cannot calculate precise fuel consumption or predict specific component wear.'
    },
    
    'normal': {
        'title': 'Readings appear normal',
        'explanation': 'Current vehicle readings are within expected ranges for the observed conditions.',
        'limitation': 'These readings provide a snapshot and cannot guarantee all vehicle systems are functioning correctly.'
    },
    
    'insufficient_data': {
        'title': 'Collecting enough readings',
        'explanation': 'No current rule matches yet. More readings will help show whether temperature settles or continues rising.',
        'limitation': 'An unmatched or incomplete reading window cannot establish vehicle condition.'
    },
    'data_unavailable': {
        'title': 'Recent readings are unavailable',
        'explanation': 'The latest readings are missing, outdated, or invalid. We need complete, recent readings before interpreting the trend.',
        'limitation': 'Unavailable readings cannot establish vehicle condition.'
    },
    'unknown': {
        'title': 'Unable to determine condition',
        'explanation': 'There is insufficient or stale data to make an assessment of the current vehicle condition.',
        'limitation': 'Missing or outdated sensor readings prevent meaningful analysis.'
    }
}


def generate_template_explanation(analysis_event):
    """
    Generate a template explanation for an analysis event
    
    Args:
        analysis_event: The analysis event from the insight engine
        
    Returns:
        Explanation object
    """
    event_id = analysis_event.get('event_id')
    condition = analysis_event.get('condition')
    approved_next_step = analysis_event.get('approved_next_step')
    limitations = analysis_event.get('limitations', [])
    
    # Get base template
    template = TEMPLATE_EXPLANATIONS.get(condition, TEMPLATE_EXPLANATIONS['unknown'])
    explanation = template['explanation']
    evidence = next((item for item in analysis_event.get('evidence', [])
                     if item.get('metric') == 'coolant_c'), None)
    if condition in ('normal_warmup', 'sustained_temperature_rise') and evidence:
        start, end, duration = (evidence.get(key) for key in ('start_value', 'end_value', 'duration_s'))
        if all(isinstance(value, (int, float)) for value in (start, end, duration)):
            observation = f'Coolant temperature went from {start:g}°C to {end:g}°C over {duration:g} seconds.'
            explanation = observation + ' ' + explanation
    
    # Build explanation object
    return {
        'event_id': event_id,
        'title': template['title'],
        'explanation': explanation,
        'next_step': approved_next_step or 'Continue monitoring vehicle readings and consult your vehicle\'s manual for warning light guidance.',
        'limitation': ' '.join(limitations) if limitations else template['limitation'],
        'explanation_source': 'template'
    }
