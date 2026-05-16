import os
import time
import json
from litellm import completion
from key_manager import key_manager

class BaseAgent:
    def __init__(self, model_name: str = "groq/llama-3.3-70b-versatile", log_callback=None):
        self.model_name = model_name
        self.log_callback = log_callback or (lambda x: None)
        self._ensure_api_key()

    def log(self, msg: str):
        self.log_callback(msg)

    def _get_current_provider(self):
        if '/' in self.model_name:
            provider = self.model_name.split('/')[0].lower()
            return provider
        # If no slash, it's almost certainly LM Studio / local model in this setup
        return "lm-studio"

    def _ensure_api_key(self):
        provider = self._get_current_provider()
        key = key_manager.get_key_for_provider(provider)
        
        if not key and provider == "lm-studio":
            # Try to find ANY URL in the key manager
            for p, keys in key_manager.keys_by_provider.items():
                for k in keys:
                    if k.startswith("http"):
                        key = k
                        break
                if key: break
            
        if key:
            self._apply_key(key)
        else:
            # Final fallback: Check if a key already exists in environment (set by user or previous run)
            env_key = f"{provider.upper()}_API_KEY"
            if os.environ.get(env_key):
                self.log(f"[INFO] No keys found in rotation pool. Using system environment variable: {env_key}")
            else:
                self.log(f"[WARN] No API keys found for {provider.upper()}. Please add them in Settings and click 'Save Configuration'.")
        
        return key

    def _rotate_api_key(self):
        provider = self._get_current_provider()
        self.log(f"[INFO] Rotating {provider.upper()} API Key...")
        key = key_manager.rotate_key_for_provider(provider)
        if key:
            self._apply_key(key)
            return True
        return False

    def _apply_key(self, key: str):
        """Configure LiteLLM environment based on key type (standard vs URL)."""
        if key.startswith('http://') or key.startswith('https://'):
            # Detect LM Studio / Local Server
            base_url = key.rstrip('/')
            if not base_url.endswith('/v1'):
                base_url += '/v1'
            self.api_base = base_url
            os.environ['OPENAI_API_KEY'] = 'lm-studio'
            # Ensure model has openai/ prefix for litellm routing
            if '/' not in self.model_name:
                self.model_name = f'openai/{self.model_name}'
        else:
            self.api_base = None
            # Standard providers: extract prefix and set env var
            if '/' in self.model_name:
                provider = self.model_name.split('/')[0].upper()
                key_map = {
                    'GROQ': 'GROQ_API_KEY',
                    'OPENAI': 'OPENAI_API_KEY',
                    'GEMINI': 'GEMINI_API_KEY',
                    'CLAUDE': 'ANTHROPIC_API_KEY',
                    'ANTHROPIC': 'ANTHROPIC_API_KEY',
                }
                env_key = key_map.get(provider, f'{provider}_API_KEY')
                os.environ[env_key] = key
            else:
                os.environ['OPENAI_API_KEY'] = key

    def _call_llm(self, system_prompt: str, user_content: str, response_model=None, response_format=None, max_retries=5):
        """Unified LLM call with rate limit handling and key rotation."""
        base_delay = 5
        
        for attempt in range(max_retries):
            self._ensure_api_key()
            try:
                kwargs = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ]
                }
                if hasattr(self, 'api_base') and self.api_base:
                    kwargs["api_base"] = self.api_base

                if response_model:
                    kwargs["response_format"] = response_model
                elif response_format:
                    kwargs["response_format"] = response_format

                response = completion(**kwargs)
                raw_content = response.choices[0].message.content.strip()
                
                # Robust cleaning for code-only responses
                if not response_model:
                    if "```" in raw_content:
                        # Extract content between backticks
                        parts = raw_content.split("```")
                        if len(parts) >= 3:
                            raw_content = parts[1]
                            # Remove language identifier if present (e.g., 'python\n')
                            if "\n" in raw_content:
                                first_line = raw_content.split("\n")[0].lower()
                                if any(lang in first_line for lang in ["python", "javascript", "typescript", "json", "yaml"]):
                                    raw_content = "\n".join(raw_content.split("\n")[1:])
                    else:
                        # If no backticks, at least try to remove obvious "Here is the code" prefixes
                        if raw_content.lower().startswith("here is"):
                            if "\n" in raw_content:
                                raw_content = "\n".join(raw_content.split("\n")[1:])

                if response_model:
                    # LiteLLM sometimes returns the object directly, sometimes a string
                    if isinstance(raw_content, str):
                        # Clean up markdown if present
                        if raw_content.startswith("```json"):
                            raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                        elif raw_content.startswith("```"):
                            raw_content = raw_content.split("```")[1].split("```")[0].strip()
                        
                        try:
                            return response_model.model_validate_json(raw_content)
                        except Exception as e:
                            # Fallback for older Pydantic or different formats
                            return response_model(**json.loads(raw_content))
                    return raw_content # It's already the model
                
                return raw_content
                
            except Exception as e:
                error_msg = str(e).lower()
                if "rate limit" in error_msg or "429" in error_msg or "rate_limit_exceeded" in error_msg:
                    old_key = os.environ.get(f'{self.model_name.split("/")[0].upper()}_API_KEY')
                    if self._rotate_api_key():
                        new_key = os.environ.get(f'{self.model_name.split("/")[0].upper()}_API_KEY')
                        if new_key == old_key:
                            # Only one key or same key returned
                            wait_time = base_delay + (attempt * 15)
                            self.log(f"  [WARN] Rate limit hit. Only one key available. Sleeping {wait_time}s...")
                            time.sleep(wait_time)
                        else:
                            self.log(f"  [WARN] Rate limit hit. Rotated to new key. Retrying...")
                            time.sleep(2)
                        continue
                    else:
                        wait_time = base_delay + (attempt * 20)
                        self.log(f"  [WARN] No keys available. Sleeping {wait_time}s...")
                        time.sleep(wait_time)
                elif "invalid api key" in error_msg or "401" in error_msg:
                    self.log(f"  [ERROR] Invalid API Key detected. Rotating...")
                    if self._rotate_api_key():
                        continue
                    else:
                        self.log("[FATAL] No valid API keys left.")
                        raise e
                else:
                    self.log(f"  [ERROR] LLM Call Failed: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    raise e
                    
        return None
