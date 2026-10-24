"""
SecondLook Explanation Service
Provides AI-powered explanations for vehicle diagnostic events
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from template_explanations import generate_template_explanation
from ai_provider import generate_ai_explanation

# Load environment variables
load_dotenv()

# Determine the frontend directory (one level up from server/)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app)

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


def validate_analysis_event(event):
    """Validate analysis event structure"""
    errors = []
    
    if not event:
        errors.append('Analysis event is required')
        return {'valid': False, 'errors': errors}
    
    if not event.get('event_id') or not isinstance(event['event_id'], str):
        errors.append('event_id must be a non-empty string')
    
    if not event.get('condition') or not isinstance(event['condition'], str):
        errors.append('condition must be a non-empty string')
    
    if not event.get('urgency') or not isinstance(event['urgency'], str):
        errors.append('urgency must be a non-empty string')
    
    if 'observed_at_ms' in event and not isinstance(event['observed_at_ms'], (int, float)):
        errors.append('observed_at_ms must be a number')
    
    if 'evidence' in event and not isinstance(event['evidence'], list):
        errors.append('evidence must be an array')
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


def validate_explanation(explanation):
    """Validate explanation output structure"""
    errors = []
    
    if not explanation:
        errors.append('Explanation is required')
        return {'valid': False, 'errors': errors}
    
    if not explanation.get('event_id') or not isinstance(explanation['event_id'], str):
        errors.append('event_id must be a non-empty string')
    
    if not explanation.get('title') or not isinstance(explanation['title'], str):
        errors.append('title must be a non-empty string')
    
    if not explanation.get('explanation') or not isinstance(explanation['explanation'], str):
        errors.append('explanation must be a non-empty string')
    
    if not explanation.get('next_step') or not isinstance(explanation['next_step'], str):
        errors.append('next_step must be a non-empty string')
    
    if not explanation.get('explanation_source') or explanation['explanation_source'] not in ['ai', 'template']:
        errors.append('explanation_source must be either "ai" or "template"')
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


@app.route('/api/explain', methods=['POST'])
def explain():
    """Generate an explanation for a vehicle diagnostic event"""
    start_time = time.time()
    
    try:
        analysis_event = request.json
        
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
        
        # Check cache for duplicate requests
        if event_id in processed_events:
            cached = processed_events[event_id]['data']
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
            print(f"[Explain] Using template explanation for {event_id}: {ai_error}")
            explanation = generate_template_explanation(analysis_event)
        
        # Validate explanation output
        output_validation = validate_explanation(explanation)
        if not output_validation['valid']:
            print(f"[Explain] Generated invalid explanation: {output_validation['errors']}")
            explanation = generate_template_explanation(analysis_event)
        
        # Cache the result
        processed_events[event_id] = {
            'data': explanation,
            'timestamp': time.time() * 1000
        }
        
        duration = (time.time() - start_time) * 1000
        print(f"[Explain] Generated explanation for {event_id} in {duration:.0f}ms (source: {explanation['explanation_source']})")
        
        return jsonify(explanation)
        
    except Exception as error:
        print(f"[Explain] Error: {error}")
        
        # Try to return template explanation as last resort
        try:
            fallback_explanation = generate_template_explanation(request.json)
            return jsonify(fallback_explanation)
        except Exception as fallback_error:
            return jsonify({
                'error': 'Failed to generate explanation',
                'message': str(error)
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
    """Serve static frontend files"""
    if path and os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')


if __name__ == '__main__':
    print(f"[Server] SecondLook Explanation Service running on port {PORT}")
    print(f"[Server] AI Provider: {AI_PROVIDER if AI_PROVIDER else 'none (template mode only)'}")
    print(f"[Server] Request timeout: {REQUEST_TIMEOUT_MS}ms")
    app.run(host='0.0.0.0', port=PORT, debug=True)
