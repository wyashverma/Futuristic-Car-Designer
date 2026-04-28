import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration settings for the application"""
    
    # API Keys
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'your-gemini-api-key-here')
    
    # Image Generation Settings
    IMAGE_WIDTH = 512
    IMAGE_HEIGHT = 512
    IMAGE_QUALITY = 90
    
    # Server Settings
    DEBUG = True
    PORT = 5000
    HOST = '0.0.0.0'
    
    # Agent Settings
    MAX_RESEARCH_DEPTH = 3
    MIN_CONFIDENCE_SCORE = 0.7