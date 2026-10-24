"""
Template Explanations
Fallback explanations when AI service is unavailable
"""

TEMPLATE_EXPLANATIONS = {
    'normal_warmup': {
        'title': 'Engine is warming up normally',
        'explanation': 'Your engine temperature is rising from a cold start, which is expected behavior. The coolant is circulating and gradually reaching its normal operating temperature.',
        'limitation': 'These readings show the warm-up process but cannot verify all cooling system components are functioning properly.'
    },
    
    'sustained_temperature_rise': {
        'title': 'Coolant temperature is continuing to rise',
        'explanation': 'Your engine coolant temperature has been rising steadily and is now above the normal operating range. This could indicate an issue with the cooling system, such as low coolant level, a malfunctioning thermostat, or reduced airflow.',
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
    
    # Build explanation object
    return {
        'event_id': event_id,
        'title': template['title'],
        'explanation': template['explanation'],
        'next_step': approved_next_step or 'Continue monitoring vehicle readings and consult your vehicle\'s manual for warning light guidance.',
        'limitation': limitations[0] if limitations else template['limitation'],
        'explanation_source': 'template'
    }
