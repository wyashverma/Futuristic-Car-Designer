import re
import json
from datetime import datetime

def sanitize_prompt(prompt: str) -> str:
    """Clean and sanitize user prompt"""
    # Remove special characters and extra spaces
    prompt = re.sub(r'[^\w\s\-,\']', '', prompt)
    prompt = ' '.join(prompt.split())
    return prompt.strip()

def extract_car_features(description: str) -> dict:
    """Extract key features from AI description"""
    features = {
        'engine': None,
        'aerodynamics': None,
        'safety': None,
        'ai_features': None,
        'performance': None
    }
    
    # Simple extraction using keywords
    sections = description.split('\n')
    current_section = None
    
    for line in sections:
        line_lower = line.lower()
        if 'engine' in line_lower:
            features['engine'] = line.strip()
        elif 'aerodynamic' in line_lower:
            features['aerodynamics'] = line.strip()
        elif 'safety' in line_lower:
            features['safety'] = line.strip()
        elif 'ai' in line_lower or 'artificial' in line_lower:
            features['ai_features'] = line.strip()
        elif 'performance' in line_lower or 'speed' in line_lower:
            features['performance'] = line.strip()
    
    return features

def format_response(design_data: dict) -> dict:
    """Format the response for frontend"""
    return {
        'success': True,
        'data': design_data,
        'timestamp': datetime.now().isoformat()
    }

def validate_api_response(response: dict) -> bool:
    """Validate API response structure"""
    required_fields = ['views', 'description']
    return all(field in response for field in required_fields)