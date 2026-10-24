"""
SecondLook Explanation Service
Provides AI-powered explanations for vehicle diagnostic events
"""

from flask import Flask, request, jsonify, send_from_directory, abort
import os
import time
import math
import json
import hashlib
from pathlib import Path
from dotenv import load_dotenv
from template_explanations import generate_template_explanation
from ai_provider import generate_ai_explanation, explanation_is_grounded

# Load environment variables
load_dotenv(Path(__file__).with_name('.env'))

# Determine the frontend directory (one level up from server/)
FRONTEND_DIR = Path(__file__).resolve().parent.parent

# Only the explicit frontend allowlist below is public, never the repository.
app = Flask(__name__, static_folder=None)

# Configuration
PORT = int(os.getenv('PORT', 3000))
REQUEST_TIMEOUT_MS = int(os.getenv('REQUEST_TIMEOUT_MS', 5000))
AI_PROVIDER = os.getenv('AI_PROVIDER', 'none')

# Request tracking for duplicate prevention
processed_events = {}
CACHE_DURATION_MS = 60000  # 1 minute


def cleanup_cache():
    """Remove expired cache entries"""
    current_time = time.time() * 1000
    expired = [k for k, v in processed_events.items() 
               if current_time - v['timestamp'] > CACHE_DURATION_MS]
    for k in expired:
        del processed_events[k]


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_analysis_event(event):
    """Validate only the shared fields consumed by the explanation service."""
    errors = []
    if not isinstance(event, dict) or not event:
        return {'valid': False, 'errors': ['Analysis event is required']}
    for field in ('event_id', 'scenario_id', 'condition', 'approved_next_step'):
        if not isinstance(event.get(field), str) or not event[field].strip():
            errors.append(f'{field} must be a non-empty string')
    if event.get('urgency') not in ('normal', 'attention', 'urgent', 'unknown'):
        errors.append('urgency must be normal, attention, urgent, or unknown')
    if 'observed_at_ms' in event and (not finite_number(event['observed_at_ms']) or event['observed_at_ms'] < 0):
        errors.append('observed_at_ms must be a finite nonnegative number')
    evidence = event.get('evidence')
    if not isinstance(evidence, list):
        errors.append('evidence must be an array')
    else:
        if not evidence and event.get('urgency') != 'unknown':
            errors.append('A finding requires numeric evidence unless urgency is unknown')
        for item in evidence:
            if not isinstance(item, dict):
                errors.append('Each evidence item must be an object')
                continue
            if item.get('metric') not in ('coolant_c', 'rpm', 'speed_kmh', 'engine_load_pct'):
                errors.append('Evidence metric must use the shared reading format')
            for field in ('start_value', 'end_value', 'duration_s'):
                if not finite_number(item.get(field)):
                    errors.append(f'{field} must be a finite number')
            if finite_number(item.get('duration_s')) and item['duration_s'] < 0:
                errors.append('duration_s must be nonnegative')
    limitations = event.get('limitations')
    if not isinstance(limitations, list) or not all(isinstance(item, str) and item.strip() for item in limitations):
        errors.append('limitations must be an array of non-empty strings')
    return {'valid': not errors, 'errors': errors}


def validate_explanation(explanation, event):
    """Enforce contract, event ownership, and the limited generated-prose guard."""
    errors = []
    if not isinstance(explanation, dict):
        return {'valid': False, 'errors': ['Explanation must be an object']}
    for field in ('event_id', 'title', 'explanation', 'next_step', 'limitation'):
        if not isinstance(explanation.get(field), str) or not explanation[field].strip():
            errors.append(f'{field} must be a non-empty string')
    if explanation.get('explanation_source') not in ('ai', 'template'):
        errors.append('explanation_source must be ai or template')
    if explanation.get('event_id') != event['event_id']:
        errors.append('event_id does not match the finding')
    if explanation.get('next_step') != event['approved_next_step']:
        errors.append('next_step must preserve the approved action')
    if isinstance(explanation.get('limitation'), str) and any(
            item not in explanation['limitation'] for item in event['limitations']):
        errors.append('limitation must retain the supplied limitations')
    if not errors and explanation.get('explanation_source') == 'ai' and not explanation_is_grounded(explanation, event):
        errors.append('Generated prose failed the grounding guard')
    return {'valid': not errors, 'errors': errors}


@app.route('/api/explain', methods=['POST'])
def explain():
    """Generate an explanation for a vehicle diagnostic event"""
    start_time = time.time()
    
    try:
        analysis_event = request.get_json(silent=True)
        
        # Validate request
        validation = validate_analysis_event(analysis_event)
        if not validation['valid']:
            return jsonify({
                'error': 'Invalid request',
                'details': validation['errors']
            }), 400
        
        event_id = analysis_event['event_id']
        
        # Clean up expired cache entries
        cleanup_cache()
        
        # Identical IDs with different evidence/actions must never share a result.
        fingerprint = hashlib.sha256(json.dumps(analysis_event, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
        cache_key = (event_id, fingerprint)
        if cache_key in processed_events:
            cached = processed_events[cache_key]['data']
            print(f"[Explain] Returning cached explanation for {event_id}")
            return jsonify(cached)
        
        # Generate explanation
        explanation = None
        
        try:
            # Try AI explanation first (if configured)
            if AI_PROVIDER and AI_PROVIDER != 'none':
                print(f"[Explain] Attempting AI explanation for {event_id}")
                
                # Call AI provider with timeout
                explanation = generate_ai_explanation(analysis_event, REQUEST_TIMEOUT_MS)
                print(f"[Explain] AI explanation generated successfully")
                
            else:
                raise Exception('AI provider not configured')
        except Exception as ai_error:
            # Fall back to template explanation
            print("[Explain] AI unavailable; using prepared template")
            explanation = generate_template_explanation(analysis_event)
        
        # A provider may choose template mode; use our prepared template in that case.
        if isinstance(explanation, dict) and explanation.get('explanation_source') == 'template':
            explanation = generate_template_explanation(analysis_event)

        # Validate explanation output
        output_validation = validate_explanation(explanation, analysis_event)
        if not output_validation['valid']:
            print(f"[Explain] Generated invalid explanation: {output_validation['errors']}")
            explanation = generate_template_explanation(analysis_event)
        
        # Keep the title, next step, and uncertainty deterministic even for AI prose.
        prepared = generate_template_explanation(analysis_event)
        for field in ('title', 'next_step', 'limitation'):
            explanation[field] = prepared[field]

        # Cache the result
        processed_events[cache_key] = {
            'data': explanation,
            'timestamp': time.time() * 1000
        }
        
        duration = (time.time() - start_time) * 1000
        print(f"[Explain] Generated explanation for {event_id} in {duration:.0f}ms (source: {explanation['explanation_source']})")
        
        return jsonify(explanation)
        
    except Exception as error:
        print("[Explain] Request failed")
        
        # Try to return template explanation as last resort
        try:
            fallback_explanation = generate_template_explanation(request.json)
            return jsonify(fallback_explanation)
        except Exception as fallback_error:
            return jsonify({
                'error': 'Failed to generate explanation',
                'message': 'Unable to prepare explanation'
            }), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    ai_available = False
    if AI_PROVIDER == 'openai':
        ai_available = bool(os.getenv('OPENAI_API_KEY'))
    
    return jsonify({
        'status': 'ok',
        'timestamp': int(time.time() * 1000),
        'ai_provider': AI_PROVIDER,
        'ai_available': ai_available
    })


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend assets only; configuration and source-server files stay private."""
    path = path or 'index.html'
    parts = Path(path).parts
    if any(part.startswith('.') for part in parts):
        abort(404)
    public_files = {'index.html', 'manifest.json', 'sw.js'}
    public_assets = {
        'js': {'.js'}, 'css': {'.css'}, 'workers': {'.js'},
        'icons': {'.png', '.svg', '.ico'}
    }
    allowed = path in public_files or (
        len(parts) > 1 and Path(path).suffix in public_assets.get(parts[0], set())
    )
    resolved = (FRONTEND_DIR / path).resolve()
    if not allowed or FRONTEND_DIR not in resolved.parents:
        abort(404)
    return send_from_directory(str(FRONTEND_DIR), path)


if __name__ == '__main__':
    print(f"[Server] SecondLook Explanation Service running on port {PORT}")
    print(f"[Server] AI Provider: {AI_PROVIDER if AI_PROVIDER else 'none (template mode only)'}")
    print(f"[Server] Request timeout: {REQUEST_TIMEOUT_MS}ms")
    app.run(host='127.0.0.1', port=PORT, debug=False)
