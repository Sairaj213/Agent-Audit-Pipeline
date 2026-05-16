import os
import json
import re
from collections import Counter
from domain_models import DirectoryEvaluation, FolderDecision
from base_agent import BaseAgent

class Agent1(BaseAgent):
    def __init__(self, root_path: str, model_name: str = "groq/llama-3.3-70b-versatile", log_callback=None): 
        super().__init__(model_name=model_name, log_callback=log_callback)
        self.root_path = os.path.abspath(root_path)
        self.tree = {}

    def get_folder_metadata(self, folder_path: str) -> dict:
        file_count = 0
        extensions = Counter()
        try:
            for root, dirs, files in os.walk(folder_path):
                file_count += len(files)
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext: extensions[ext] += 1
        except Exception:
            pass
        return {"file_count": file_count, "top_extensions": [ext for ext, _ in extensions.most_common(3)]}

    def ask_llm(self, current_path: str, files_list: list, folders_metadata: list) -> DirectoryEvaluation:
        if not files_list and not folders_metadata:
            return DirectoryEvaluation(files_to_include=[], folders_to_traverse=[])
            
        system_prompt = "You are an expert software architect mapping a repository."
        user_prompt = f"""
        Current path: {current_path}
        FILES: {json.dumps(files_list, indent=2)}
        SUB-FOLDERS: {json.dumps(folders_metadata, indent=2)}

        Task 1: Evaluate the FILES. Return relevant files (source code, configs, docs). Skip logs, zips, binaries.
        Task 2: Evaluate SUB-FOLDERS. Decide which to traverse (skip .venv, node_modules, .git).
        Respond using the requested JSON schema.
        """
        try:
            return self._call_llm(system_prompt, user_prompt, response_model=DirectoryEvaluation)
        except Exception as e:
            self.log(f"[ERROR] Agent 1 LLM Request failed: {e}")
            return DirectoryEvaluation(
                files_to_include=files_list,
                folders_to_traverse=[FolderDecision(folder_name=f['folder_name'], should_traverse=False, reason="Error") for f in folders_metadata]
            )

    def traverse(self, current_path: str) -> dict:
        current_node = {"files":[], "folders": {}}
        try:
            items = os.listdir(current_path)
        except PermissionError:
            return current_node
            
        files =[i for i in items if os.path.isfile(os.path.join(current_path, i))]
        folders =[i for i in items if os.path.isdir(os.path.join(current_path, i))]
                
        folders_metadata =[{"folder_name": f, **self.get_folder_metadata(os.path.join(current_path, f))} for f in folders]
            
        self.log(f"\n[SCAN] Analyzing path: {current_path}")
        decisions = self.ask_llm(current_path, files, folders_metadata)
        
        include_list = decisions.files_to_include if decisions else [f for f in files if f.endswith(('.py', '.yaml', '.txt', '.md'))]
        
        current_node["files"] = include_list
        for file in files:
            if file in include_list:
                self.log(f"  [+] INCLUDE FILE -> {file}")
            else:
                self.log(f"  [-] SKIP FILE    -> {file}")
        
        traverse_list = decisions.folders_to_traverse if decisions else []
        for decision in traverse_list:
            if decision.should_traverse:
                self.log(f"  [+] TRAVERSE DIR -> {decision.folder_name} ({decision.reason})")
                current_node["folders"][decision.folder_name] = self.traverse(os.path.join(current_path, decision.folder_name))
            else:
                self.log(f"  [-] SKIP DIR     -> {decision.folder_name} ({decision.reason})")
                
        return current_node

    def discover_public_interfaces(self, filesystem: dict) -> dict[str, list[str]]:
        """
        Scans all files to find which names are imported from which modules.
        Returns a map of {file_path: [imported_names]}.
        """
        self.log("[INFO] Discovering public interfaces and cross-file dependencies...")
        interface_map = {} # {module_name: set(names)}
        
        # Match 'from module import name1, name2' or 'from .module import name'
        from_import_pattern = re.compile(r"from\s+([\w\.]+)\s+import\s+([\w\s,]+)")
        
        for file_path, content in filesystem.items():
            # Find all names imported from other modules
            matches = from_import_pattern.findall(content)
            for module_path, names_str in matches:
                # Clean up names
                names = [n.strip() for n in names_str.split(',')]
                
                # Resolve module_path to a file_path if possible
                # This is a heuristic: check if module_path.py exists
                target_file = module_path.replace('.', '/') + ".py"
                # Check for relative imports or just local files
                potential_matches = [f for f in filesystem.keys() if f.endswith(target_file)]
                
                if potential_matches:
                    actual_target = potential_matches[0]
                    if actual_target not in interface_map:
                        interface_map[actual_target] = set()
                    for name in names:
                        interface_map[actual_target].add(name)
        
        # Convert sets to lists for JSON compatibility
        return {k: list(v) for k, v in interface_map.items()}

    def run(self) -> dict:
        self.tree = self.traverse(self.root_path)
        return self.tree