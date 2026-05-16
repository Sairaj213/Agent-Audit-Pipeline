import os

class KeyManager:
    def __init__(self, keys_file="api_keys.txt"):
        self.keys_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), keys_file)
        self.keys_by_provider = self._load_keys()
        self.rotation_indices = {} # provider -> index

    def _load_keys(self):
        """Loads keys from file. Expected format: 'provider|key' or just 'key' (defaults to groq)."""
        data = {}
        if not os.path.exists(self.keys_file):
            return data
            
        try:
            with open(self.keys_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line: continue
                    
                    if "|" in line:
                        provider, key = line.split("|", 1)
                        provider = provider.lower()
                    elif line.startswith("http://") or line.startswith("https://"):
                        provider = "lm-studio"
                        key = line
                    else:
                        # Legacy/default fallback to groq
                        provider = "groq"
                        key = line
                    
                    if provider not in data:
                        data[provider] = []
                    data[provider].append(key)
        except Exception:
            pass
        return data

    def reload(self):
        self.keys_by_provider = self._load_keys()
        self.rotation_indices = {}

    def get_key_for_provider(self, provider: str):
        provider = provider.lower()
        keys = self.keys_by_provider.get(provider, [])
        if not keys:
            # Fallback: if they didn't specify provider in file, but we have keys, 
            # maybe they are old format groq keys.
            if provider == "groq":
                return self.keys_by_provider.get("default", [None])[0]
            return None
            
        idx = self.rotation_indices.get(provider, 0)
        return keys[idx % len(keys)]

    def rotate_key_for_provider(self, provider: str):
        provider = provider.lower()
        keys = self.keys_by_provider.get(provider, [])
        if not keys: return None
        
        current_idx = self.rotation_indices.get(provider, 0)
        new_idx = (current_idx + 1) % len(keys)
        self.rotation_indices[provider] = new_idx
        return keys[new_idx]

    # Compatibility methods for old calls
    def get_key(self):
        # Default to groq for generic calls
        return self.get_key_for_provider("groq")

    def rotate_key(self):
        return self.rotate_key_for_provider("groq")

key_manager = KeyManager()
