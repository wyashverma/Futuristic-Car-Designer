import requests
import io
from PIL import Image
from typing import Dict, Any
import time
import base64

class CarImageGenerator:
    """Handles multi-view car image generation"""
    
    def __init__(self):
        self.base_url = "https://image.pollinations.ai/prompt"
        self.default_width = 512
        self.default_height = 512
        
    def generate_car_views(self, user_prompt: str, enhanced_prompts: Dict[str, str]) -> Dict[str, Any]:
        """
        Generate 4 views of the car
        """
        
        views = ['top', 'bottom', 'left', 'right']
        generated_images = {}
        
        for view in views:
            try:
                # Get enhanced prompt for this view
                view_prompt = enhanced_prompts.get(view, f"{user_prompt}, {view} view")
                
                # Generate image
                image = self._generate_single_image(view_prompt, view)
                
                if image:
                    # Convert to base64 for frontend
                    buffered = io.BytesIO()
                    image.save(buffered, format="PNG", quality=90)
                    img_str = base64.b64encode(buffered.getvalue()).decode()
                    generated_images[view] = f"data:image/png;base64,{img_str}"
                else:
                    generated_images[view] = None
                    
                # Small delay between requests
                time.sleep(0.5)
                
            except Exception as e:
                print(f"Error generating {view} view: {str(e)}")
                generated_images[view] = None
        
        return generated_images
    
    def _generate_single_image(self, prompt: str, view: str) -> Image.Image | None:
        """Generate a single car view image"""
        
        # Enhance prompt for better car visualization
        enhanced_prompt = f"""
        Professional automotive photography, {prompt}, 
        {view} view perspective, 
        realistic car design, detailed vehicle rendering,
        studio lighting, 8K quality, clean background,
        showcasing aerodynamic features
        """
        
        # Clean prompt
        clean_prompt = ' '.join(enhanced_prompt.split())
        
        url = f"{self.base_url}/{requests.utils.quote(clean_prompt)}"
        params = {
            "width": self.default_width,
            "height": self.default_height,
            "nologo": "true",
            "model": "flux"
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                return Image.open(io.BytesIO(response.content))
        except Exception as e:
            print(f"Image generation failed for {view}: {str(e)}")
        
        # Return placeholder if generation fails
        return self._create_placeholder(view)
    
    def _create_placeholder(self, view: str) -> Image.Image:
        """Create a placeholder image with view text"""
        img = Image.new('RGB', (512, 512), color=(100, 100, 120))
        return img