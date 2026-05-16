import os
import subprocess
import json

STATE_FILE = "pipeline_state.json"

# ── State Management (Bridge between separate HTTP requests) ─────

def save_state(key: str, data: any):
    """Saves pipeline state to disk so separate API calls can share context."""
    state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
        except Exception:
            pass
            
    state[key] = data
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)

def get_state(key: str) -> any:
    """Retrieves pipeline state from disk."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
            return state.get(key)
        except Exception:
            return None
    return None

def clear_state():
    """Clears the state file for a fresh pipeline run."""
    if os.path.exists(STATE_FILE):
        try:
            os.remove(STATE_FILE)
        except Exception:
            pass

# ── Existing Utilities ──────────────────────────────────────────

def clone_github_repo(repo_url: str, log_callback) -> str:
    """Clones a GitHub repository locally into a dedicated ingestion folder."""
    repo_name = repo_url.rstrip('/').split('/')[-1]
    if repo_name.endswith('.git'):
        repo_name = repo_name[:-4]
        
    target_dir = os.path.join(os.getcwd(), f"ingested_{repo_name}")
    
    if os.path.exists(target_dir):
        log_callback(f"[INFO] Directory {target_dir} already exists. Using existing directory.")
        return target_dir
        
    log_callback(f"[INFO] Cloning {repo_url} into {target_dir}...")
    try:
        # Depth 1 ensures we only get the latest code, saving massive amounts of time
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, target_dir], 
            check=True, 
            capture_output=True
        )
        log_callback(f"[SUCCESS] Successfully cloned {repo_name}")
    except subprocess.CalledProcessError as e:
        log_callback(f"[ERROR] Failed to clone repository: {e.stderr.decode('utf-8', errors='ignore')}")
        return ""
        
    return target_dir

def load_filesystem_context(target_dir: str, file_paths: list[str], log_callback) -> dict:
    """
    Reads the physical files from the disk and loads them into an in-memory dictionary.
    This is what Agent 3 uses to audit the code without executing it.
    """
    filesystem = {}
    log_callback(f"\n[INFO] Loading {len(file_paths)} files into memory context...")
    
    for relative_path in file_paths:
        # Normalize paths to prevent issues between Windows/Mac/Linux
        safe_path = relative_path.lstrip("\\/")
        absolute_path = os.path.join(target_dir, safe_path)
        
        try:
            with open(absolute_path, 'r', encoding='utf-8') as f:
                filesystem[relative_path] = f.read()
        except UnicodeDecodeError:
            log_callback(f"  [WARN] Skipping {relative_path} - Appears to be a binary file.")
        except FileNotFoundError:
            log_callback(f"  [WARN] Skipping {relative_path} - File not found on disk.")
        except Exception as e:
            log_callback(f"  [WARN] Could not read {relative_path}: {e}")
            
    log_callback(f"[SUCCESS] Loaded {len(filesystem)} text files into memory.")
    return filesystem