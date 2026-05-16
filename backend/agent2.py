import os
import json
from domain_models import ExecutionNode, Agent2ExecutionPlan
from base_agent import BaseAgent


class Agent2(BaseAgent):
    """
    Agent 2: Strict Execution Sequencer.
    Takes the curated blueprint from Agent 1 (a tree of files/folders)
    and uses the directory structure + file paths alone to construct
    a dependency-ordered execution plan. Does NOT read source code —
    that is Agent 3's responsibility.
    """

    def __init__(self, blueprint: dict, model_name: str = "groq/llama-3.3-70b-versatile", log_callback=None):
        super().__init__(model_name=model_name, log_callback=log_callback)
        self.blueprint = blueprint

    def flatten_blueprint(self) -> list[str]:
        """Recursively flatten the nested tree into a flat list of relative file paths."""
        def flatten(node, current_path=""):
            paths = []
            for file in node.get("files", []):
                paths.append(os.path.join(current_path, file).replace("\\", "/"))
            for folder_name, folder_data in node.get("folders", {}).items():
                paths.extend(flatten(folder_data, os.path.join(current_path, folder_name).replace("\\", "/")))
            return paths

        return flatten(self.blueprint)

    def format_tree_structure(self) -> str:
        """Convert the blueprint tree into a human-readable directory tree string for the LLM."""
        lines = []

        def walk(node, prefix="", depth=0):
            # Folders first
            folders = node.get("folders", {})
            files = node.get("files", [])

            folder_items = list(folders.items())
            file_items = files

            all_items = [(name, "folder", data) for name, data in folder_items] + \
                        [(name, "file", None) for name in file_items]

            for i, (name, kind, data) in enumerate(all_items):
                is_last = (i == len(all_items) - 1)
                connector = "+-- " if is_last else "|-- "
                if kind == "folder":
                    lines.append(f"{prefix}{connector}{name}/")
                    extension = "    " if is_last else "|   "
                    walk(data, prefix + extension, depth + 1)
                else:
                    lines.append(f"{prefix}{connector}{name}")

        walk(self.blueprint)
        return "\n".join(lines)

    def construct_execution_plan(self, all_files: list[str], tree_structure: str) -> Agent2ExecutionPlan | None:
        """Send the blueprint structure to the LLM and get a strict execution sequence."""
        system_prompt = "You are an autonomous agent constructing a strict execution sequence for a software repository."
        user_prompt = f"""
REPOSOTORY STRUCTURE:
{tree_structure}

FLAT FILE LIST (all files that MUST be included):
{json.dumps(all_files, indent=2)}

RULES:
1. You MUST include EVERY SINGLE FILE from the list above. Do NOT omit any file.
2. Order files so that foundational files come FIRST:
   - Configuration files (config.yaml, .env, requirements.txt, package.json) -> earliest
   - License, README, documentation -> early (no dependencies)
   - Utility/helper modules deep in subdirectories -> before the files that would use them
   - Core library files -> before application entry points
   - Entry points (app.py, main.py, index.js, server.py) -> last
3. For each file, list its likely dependencies based on directory structure and naming conventions.
   If a file has no dependencies, leave the dependencies list empty.
4. Files in the same subdirectory likely depend on each other — utilities before consumers.

Return ONLY the structured execution sequence. No summaries or explanations."""

        try:
            self.log("[LLM] Analyzing blueprint structure...")
            return self._call_llm(system_prompt, user_prompt, response_model=Agent2ExecutionPlan)
        except Exception as e:
            self.log(f"[ERROR] Failed to construct execution plan: {e}")
            return None

    def run(self) -> dict | None:
        """Main execution flow for Agent 2."""
        self.log("[INFO] Agent 2: Strict Execution Sequencer initialized.")

        # Step 1: Flatten blueprint into file paths
        all_files = self.flatten_blueprint()
        if not all_files:
            self.log("[ERROR] Blueprint is empty — no files to sequence.")
            return None

        self.log(f"[INFO] Loaded {len(all_files)} files from Agent 1 blueprint.")

        # Step 2: Format the tree structure for the LLM
        tree_structure = self.format_tree_structure()
        self.log(f"\n[STRUCTURE] Repository layout:")
        for line in tree_structure.split("\n"):
            self.log(f"  {line}")

        # Step 3: Construct execution plan via LLM (structure-only, no code reading)
        self.log("\n[PHASE] Analyzing structure to build strict execution sequence...")
        plan = self.construct_execution_plan(all_files, tree_structure)

        if plan:
            self.log("\n[SUCCESS] Strict Execution Sequence Generated!")
            for index, node in enumerate(plan.execution_sequence):
                deps = ", ".join(node.dependencies) if node.dependencies else "None"
                self.log(f"  [{index + 1}] {node.file_path}  depends on: {deps}")
            try:
                return plan.model_dump()
            except AttributeError:
                return plan.dict()
        else:
            self.log("  [WARN] Agent 2 failed. Falling back to simple sequential execution.")
            seq = [{"file_path": f, "dependencies": []} for f in all_files]
            return {"plan_rationale": "Fallback", "execution_sequence": seq}
