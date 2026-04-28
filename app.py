from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from agentic_ai import AgenticAISystem
from image_generator import CarImageGenerator
from config import Config
from utils import sanitize_prompt, format_response
import logging
import traceback

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:5500", "http://127.0.0.1:5500", "*"])
app.config.from_object(Config)

# Initialize AI systems
ai_system = AgenticAISystem()
image_gen = CarImageGenerator()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Car Designer API is running'})

@app.route('/api/design', methods=['POST'])
def create_car_design():
    """
    Main endpoint for car design generation
    Expects JSON: {'prompt': 'user description'}
    """
    try:
        data = request.json
        user_prompt = sanitize_prompt(data.get('prompt', ''))
        
        if not user_prompt:
            return jsonify({'error': 'No prompt provided'}), 400
        
        logger.info(f"Processing design request: {user_prompt[:100]}")
        
        # Step 1: Agentic AI Research & Analysis
        logger.info("Step 1: Running agentic AI analysis...")
        ai_analysis = ai_system.research_and_analyze(user_prompt)
        
        # Step 2: Get enhanced prompts for different views
        logger.info("Step 2: Generating enhanced prompts for multi-view...")
        enhanced_prompts = ai_system.generate_enhanced_prompt(user_prompt, ai_analysis)
        
        # Step 3: Generate multi-view images
        logger.info("Step 3: Generating 4 car views...")
        images = image_gen.generate_car_views(user_prompt, enhanced_prompts)
        
        # Step 4: Compile response
        response = {
            'success': True,
            'description': ai_analysis.get('description', ''),
            'recommendations': ai_analysis.get('recommendations', ''),
            'images': images,
            'metadata': {
                'prompt': user_prompt,
                'views_generated': len([v for v in images.values() if v is not None]),
                'analysis_complete': True
            }
        }
        
        logger.info("Design generation complete!")
        return jsonify(format_response(response))
        
    except Exception as e:
        logger.error(f"Error in design generation: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to generate car design'
        }), 500

@app.route('/api/regenerate_view', methods=['POST'])
def regenerate_view():
    """Regenerate a specific view"""
    try:
        data = request.json
        view = data.get('view')
        prompt = data.get('prompt')
        
        if not view or not prompt:
            return jsonify({'error': 'Missing view or prompt'}), 400
        
        # Generate single view
        enhanced_prompts = {view: prompt}
        images = image_gen.generate_car_views(prompt, enhanced_prompts)
        
        return jsonify({
            'success': True,
            'image': images.get(view)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analyze_only', methods=['POST'])
def analyze_only():
    """Only run AI analysis without image generation"""
    try:
        data = request.json
        user_prompt = sanitize_prompt(data.get('prompt', ''))
        
        analysis = ai_system.research_and_analyze(user_prompt)
        
        return jsonify({
            'success': True,
            'description': analysis.get('description', '')
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    """Main chat endpoint for car design requests"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    try:
        data = request.json
        message = sanitize_prompt(data.get('message', ''))
        session_id = data.get('session_id', '')
        
        if not message:
            return jsonify({'success': False, 'error': 'No message provided'}), 400
        
        logger.info(f"Chat message from {session_id}: {message[:100]}")
        
        # Step 1: Run agentic AI analysis
        logger.info("Step 1: Running agentic AI analysis...")
        ai_analysis = ai_system.research_and_analyze(message)
        
        # Step 2: Generate enhanced prompts for images
        logger.info("Step 2: Generating enhanced prompts...")
        enhanced_prompts = ai_system.generate_enhanced_prompt(message, ai_analysis)
        
        # Step 3: Generate car images
        logger.info("Step 3: Generating car images...")
        images = image_gen.generate_car_views(message, enhanced_prompts)
        
        response = {
            'success': True,
            'message': ai_analysis.get('description', ''),
            'images': images,
            'mode': 'Design',
            'session_id': session_id
        }
        
        logger.info("Chat request completed successfully")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to process chat request'
        }), 500

if __name__ == '__main__':
    print("Futuristic Car Designer API Starting...")
    print(f"Running on http://{Config.HOST}:{Config.PORT}")
    print(f"Debug mode: {Config.DEBUG}")
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )