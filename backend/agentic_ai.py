from google import genai
from typing import Dict, Any
import json
import re
import time
from config import Config

class AgenticAISystem:
    """
    Advanced Agentic AI System for automotive R&D
    Performs multi-step reasoning and research-based analysis
    """
    
    def __init__(self):
        """Initialize the AI system with Gemini"""
        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model_name = 'gemini-2.5-flash'
        self.max_retries = 3
        self.base_delay = 2  # Start with 2 second delay
    
    def _call_api_with_retry(self, prompt: str, max_retries: int = None) -> str:
        """
        Call Gemini API with exponential backoff retry logic
        Handles 503 UNAVAILABLE errors gracefully
        """
        if max_retries is None:
            max_retries = self.max_retries
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                return response.text
            except Exception as e:
                last_error = e
                error_str = str(e)
                
                # Check if it's a 503 or rate limit error
                is_unavailable = '503' in error_str or 'UNAVAILABLE' in error_str or 'high demand' in error_str
                is_rate_limit = '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str
                
                if not (is_unavailable or is_rate_limit):
                    # If it's not a temporary error, fail immediately
                    raise
                
                if attempt < max_retries - 1:
                    # Exponential backoff: 2s, 4s, 8s
                    delay = self.base_delay * (2 ** attempt)
                    print(f"API unavailable (attempt {attempt + 1}/{max_retries}). Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    print(f"API still unavailable after {max_retries} retries. Failing gracefully.")
        
        # If all retries failed, return a helpful error message
        if last_error:
            raise Exception(f"Service temporarily unavailable after {max_retries} attempts: {str(last_error)}")
        raise Exception("API call failed after all retries")
        
    def research_and_analyze(self, user_prompt: str) -> Dict[str, Any]:
        """
        Perform research-style analysis on car design
        Uses chain-of-thought reasoning for professional results
        """
        
        # Step 1: Initial Analysis
        initial_analysis = self._initial_analysis(user_prompt)
        
        # Step 2: Research Phase
        research_results = self._research_phase(initial_analysis)
        
        # Step 3: Engineering Recommendations
        recommendations = self._engineering_analysis(research_results)
        
        # Step 4: Final Synthesis
        final_response = self._synthesize_results(recommendations)
        
        return final_response
    
    def _initial_analysis(self, prompt: str) -> Dict[str, Any]:
        """First pass - understand requirements"""
        
        analysis_prompt = f"""
        You are a senior automotive R&D engineer. Analyze this car design request:
        
        "{prompt}"
        
        Provide initial analysis in JSON format:
        {{
            "car_type": "vehicle category",
            "target_market": "luxury/sports/electric/SUV etc",
            "key_requirements": ["requirement1", "requirement2"],
            "complexity_level": "low/medium/high",
            "potential_challenges": ["challenge1", "challenge2"]
        }}
        """
        
        try:
            response_text = self._call_api_with_retry(analysis_prompt)
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {}
        except Exception as e:
            print(f"Initial analysis failed: {str(e)}")
            return {}
    
    def _research_phase(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Deep research on specifications and innovations"""
        
        research_prompt = f"""
        Based on this car analysis:
        Type: {analysis.get('car_type', 'Unknown')}
        Market: {analysis.get('target_market', 'Unknown')}
        Requirements: {analysis.get('key_requirements', [])}
        
        Provide detailed R&D research covering:
        
        1. **POWERTRAIN & PERFORMANCE**
           - Optimal engine/motor configuration
           - Expected horsepower and torque
           - 0-60 mph acceleration time
           - Top speed estimates
           - Energy efficiency metrics
        
        2. **AERODYNAMICS**
           - Drag coefficient targets (Cd value)
           - Key aerodynamic features needed
           - Downforce requirements
           - Cooling system integration
        
        3. **ADVANCED TECHNOLOGIES**
           - AI integration possibilities
           - Autonomous driving capabilities
           - Connectivity features
           - Smart cockpit innovations
        
        4. **SAFETY SYSTEMS**
           - Active safety features
           - Passive safety structure
           - Emergency response systems
           - Crash test predictions
        
        5. **MATERIAL SCIENCE**
           - Recommended materials for weight reduction
           - Sustainable options
           - Structural reinforcements
        
        Provide specific numbers, percentages, and technical details. Be professional and research-oriented.
        """
        
        try:
            response_text = self._call_api_with_retry(research_prompt)
            return {'research_output': response_text}
        except Exception as e:
            print(f"Research phase failed: {str(e)}")
            return {'research_output': f"Research error: {str(e)}"}
    
    def _engineering_analysis(self, research: Dict[str, Any]) -> Dict[str, Any]:
        """Generate engineering recommendations with improvements"""
        
        if 'research_output' not in research:
            return {}
        
        eng_prompt = f"""
        Based on this research:
        {research['research_output']}
        
        Provide actionable engineering recommendations:
        
        1. **SPEED IMPROVEMENTS** (specific recommendations to increase speed by X%)
        2. **AERODYNAMICS ENHANCEMENTS** (specific Cd improvements)
        3. **ENGINE SPECIFICATIONS** (detailed specs with power/torque curves)
        4. **ADVANCED FEATURES** (3-5 cutting-edge features to include)
        5. **FUEL EFFICIENCY** (MPGe or efficiency improvements)
        6. **COST OPTIMIZATION** (ways to reduce cost without sacrificing quality)
        
        Format as professional engineering report with bullet points and specific numbers.
        """
        
        try:
            response_text = self._call_api_with_retry(eng_prompt)
            return {'engineering_recommendations': response_text}
        except Exception as e:
            print(f"Engineering analysis failed: {str(e)}")
            return {}
    
    def _synthesize_results(self, recommendations: Dict[str, Any]) -> Dict[str, Any]:
        """Final synthesis into user-friendly format"""
        
        eng_rec = recommendations.get('engineering_recommendations', '')
        
        synthesis_prompt = f"""
        Transform this engineering analysis into a comprehensive car description:
        
        {eng_rec}
        
        Create a structured response with these sections:
        
        ## 🚗 **CAR OVERVIEW**
        [Brief summary of the car]
        
        ## ⚡ **PERFORMANCE SPECIFICATIONS**
        - Engine/Motor: 
        - Horsepower: 
        - Torque: 
        - 0-60 mph: 
        - Top Speed: 
        
        ##  **AERODYNAMICS ENHANCEMENTS**
        [List 3-4 specific aerodynamic improvements with numbers]
        
        ##  **ADVANCED AI & TECH FEATURES**
        [List 4-5 cutting-edge technologies with descriptions]
        
        ##  **SAFETY INNOVATIONS**
        [List safety features]
        
        ##  **UNIQUE SELLING POINTS**
        [3-4 reasons this car is special]
        
        ##  **PERFORMANCE COMPARISON**
        Compare this car to current market leaders in 3-4 metrics
        
        Make it exciting, professional, and detailed. Use emojis for better readability.
        """
        
        try:
            response_text = self._call_api_with_retry(synthesis_prompt)
            return {
                'description': response_text,
                'recommendations': eng_rec
            }
        except Exception as e:
            error_msg = str(e)
            return {
                'description': f"Error generating description: {error_msg}",
                'recommendations': ''
            }
    
    def generate_enhanced_prompt(self, original_prompt: str, analysis: Dict[str, Any]) -> Dict[str, str]:
        """Generate enhanced prompts for different car views"""
        
        views = ['top', 'bottom', 'left', 'right']
        enhanced_prompts = {}
        
        for view in views:
            view_prompt = f"""
            {original_prompt}
            
            Generate a {view} view of this car. 
            Style: Photorealistic, professional automotive rendering, 8K quality, studio lighting, clean background.
            Focus on showing distinctive {view} perspective features.
            """
            enhanced_prompts[view] = view_prompt
        
        return enhanced_prompts