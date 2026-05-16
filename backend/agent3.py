import os
import json
import time
import subprocess
import sys
import io
from base_agent import BaseAgent
from domain_models import (
    FileAudit, 
    GlobalPatchPlan,
    FilePatch,
    FrontendAuditData,
    FrontendAuditFileResult,
    FrontendApprovalItem,
    FrontendAuditSummary
)

# Optional: Using unidiff for smarter patching if we wanted to be very advanced
# For now, we'll use a robust diff/patch approach or full-file rewrite.

class Agent3(BaseAgent):
    """
    Agent 3: The Self-Healing Auditor & Remediator.
    Iteratively audits, patches, and verifies code to ensure runnability.
    """
    
    def __init__(self, model_name: str = "groq/llama-3.3-70b-versatile", api_key: str = None, log_callback=None, python_exe: str = None, fix_request: dict = None):
        super().__init__(model_name=model_name, log_callback=log_callback)
        self.python_exe = python_exe or sys.executable
        self.fix_request = fix_request

    def pass_1_audit_files(self, execution_plan: list[str], filesystem: dict) -> list[dict]:
        """Pass 1: Read all files in sequence and generate a vulnerability ledger."""
        self.log("\n[PHASE 1] Initiating Isolated File Audits...")
        audit_ledger = []
        
        fix_msg = ""
        if self.fix_request:
            fix_msg = f"CRITICAL PRIORITY: The user attempted to run the project using `{self.fix_request['command']}` and it failed with the following error:\n{self.fix_request['error_message']}\nYour ABSOLUTE PRIORITY is to find the cause of this error and fix it immediately while maintaining overall project health.\n"

        system_prompt = f"""You are an elite, language-agnostic Code Quality & Resilience Auditor.
Your job is to actively improve the codebase while STRICTLY maintaining its runnability in its target environment.

You MUST find 1-2 constructive improvements per file. If the code is logically sound, focus on:
1. Adding comprehensive, idiomatic documentation (e.g., JSDoc, JavaDoc, Python docstrings) and inline comments.
2. Improving variable naming for extreme clarity.
3. Upgrading basic console prints to use standard logging frameworks appropriate for the language.

CRITICAL 'DO NOT BREAK IT' RULES:
- DO NOT inject runtime input validation into mathematical, tensor-based, or compiled/traced functions (regardless of language). This often breaks static computation graphs or compiler optimizations.
- DO NOT restructure the architectural interface. Do not hide public/exported variables or functions inside private scopes, as this breaks cross-file dependencies.

{fix_msg}
Output a JSON object matching the FileAudit schema.
"""

        for file_path in execution_plan:
            if file_path not in filesystem:
                continue
                
            self.log(f"  -> Auditing {file_path}...")
            file_content = filesystem[file_path]
            user_prompt = f"TARGET FILE_PATH: {file_path}\n\nCONTENT:\n{file_content}\n\nAnalyze and return JSON."
            
            try:
                result = self._call_llm(system_prompt, user_prompt, response_model=FileAudit)
                if result:
                    audit_ledger.append(result.model_dump())
                    self.log(f"     [+] Found {len(result.vulnerabilities)} issues.")
            except Exception as e:
                self.log(f"     [-] Audit failed for {file_path}: {e}")
                
        return audit_ledger

    def verify_file_syntax(self, file_path: str, content: str, target_dir: str) -> tuple[bool, str]:
        """Checks if the given content is syntactically valid."""
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in ['.py']:
            return True, "" # Skip syntax check for non-python files
            
        temp_file = os.path.join(target_dir, f".verify_{os.path.basename(file_path)}")
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(content)
            
        try:
            if ext == '.py':
                result = subprocess.run([self.python_exe, '-m', 'py_compile', temp_file], capture_output=True, text=True)
                if result.returncode != 0:
                    return False, result.stderr
            return True, ""
        except Exception as e:
            return False, str(e)
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    def apply_patch_logic(self, original_content: str, patch_str: str) -> str:
        """
        Attempts to apply a Unified Diff string to the original content.
        Uses the 'patch' command if available, otherwise falls back to a simple replacement logic.
        """
        # We'll use a temporary file approach with the 'patch' utility if on Unix, 
        # but on Windows we'll use a Python-based patch applier or LLM fallback.
        # FOR MAXIMUM RELIABILITY: We'll ask the LLM for the FULL FILE content if the diff fails.
        return None # Placeholder for failed application

    def generate_remediation(self, file_path: str, content: str, issues: list[str], attempt: int, protected_names: list[str] = None) -> str | None:
        """Generates the FULL new content for the file. Most robust way to avoid syntax errors."""
        api_constraint = ""
        if protected_names:
            api_constraint = f"\nCRITICAL: The following names are imported by other files and MUST remain available at the module level: {', '.join(protected_names)}."

        system_prompt = f"""You are a master software engineer.
Rewrite the provided file to fix ONLY the specified security and logic issues.
You MUST return the FULL, COMPLETE content of the file.
DO NOT use placeholders like '// ... rest of code'.
{api_constraint}

CRITICAL ARCHITECTURE RULE: DO NOT change the file's overall architecture. DO NOT move public/global variables into private scopes. DO NOT alter function signatures. Make the ABSOLUTE MINIMAL necessary changes to fix the identified issues. If an issue asks you to add validation that would break compiler optimizations, static graphs, or tensor operations in the target language, ignore that specific issue.

STRICT RULE: This is a '{os.path.splitext(file_path)[1]}' file. 
DO NOT wrap the output in markdown code blocks. 
DO NOT add any explanatory text.
IF THIS IS A PLAIN TEXT, CONFIG, OR YAML FILE, DO NOT ADD PROGRAMMING LANGUAGE QUOTES OR COMMENTS UNLESS THEY WERE IN THE ORIGINAL.
"""
        user_prompt = f"""FILE: {file_path}
ISSUES TO FIX:
{json.dumps(issues, indent=2)}

ORIGINAL CODE:
\"\"\"
{content}
\"\"\"

Return the new code."""

        # Note: We don't use response_model here because we want raw text
        return self._call_llm(system_prompt, user_prompt)

    def pass_2_generate_patch_plan(self, audit_ledger: list[dict], filesystem: dict, target_dir: str = None, protected_interfaces: dict = None) -> GlobalPatchPlan:
        """
        Refactored Pass 2: The 'Full-Rewrite' Strategy with Verification.
        """
        self.log("\n[PHASE 2] Synthesizing Remediation Plan with Full-Rewrite Strategy...")
        protected_interfaces = protected_interfaces or {}
        
        final_files_to_patch = []
        
        for audit in audit_ledger:
            file_path = audit['file_path']
            if file_path.endswith('requirements.txt'):
                continue # Skip mechanical file
                
            issues = audit['vulnerabilities']
            if not issues: continue
            
            self.log(f"  -> Remediating {file_path}...")
            original_content = filesystem[file_path]
            protected_names = protected_interfaces.get(file_path, [])
            
            max_retries = 3
            for attempt in range(max_retries):
                new_content = self.generate_remediation(file_path, original_content, issues, attempt, protected_names)
                if not new_content: break
                
                # Verify
                is_valid, error = self.verify_file_syntax(file_path, new_content, target_dir or ".")
                if is_valid:
                    self.log(f"     [+] {file_path} verified successfully.")
                    # We store it in a way that Pass 3 can apply it.
                    # Since we are doing Full-Rewrite, 'diff_content' will actually be the full file.
                    final_files_to_patch.append(FilePatch(file_path=file_path, diff_content=new_content))
                    break
                else:
                    self.log(f"     [!] Attempt {attempt+1} failed verification: {error[:100]}...")
                    # Feed error back in next retry if needed
            
        return GlobalPatchPlan(
            plan_rationale="Used Full-Rewrite strategy to ensure runnability and avoid patch drift.",
            files_to_patch=final_files_to_patch
        )

    def pass_3_execute_patches(self, plan: GlobalPatchPlan, filesystem: dict) -> dict:
        """In Full-Rewrite mode, we replace content and perform Dependency Healing."""
        self.log("\n[PHASE 3] Finalizing Remediations & Healing Dependencies...")
        updated_fs = filesystem.copy()
        for file_patch in plan.files_to_patch:
            updated_fs[file_patch.file_path] = file_patch.diff_content
            
        # --- Dependency Healing ---
        self.log("[INFO] Reconciling requirements.txt with actual imports...")
        import re
        all_imports = set()
        import_pattern = re.compile(r"^(?:import|from)\s+([\w]+)", re.MULTILINE)
        
        # Scan all python files for top-level imports
        for file_path, content in updated_fs.items():
            if file_path.endswith('.py'):
                matches = import_pattern.findall(content)
                for m in matches:
                    if m not in ['jax', 'jaxlib', 'numpy', 'matplotlib', 'os', 'sys', 'time', 'json', 're', 'subprocess', 'io']:
                        # Exclude standard libs and already known project-specific ones
                        all_imports.add(m.lower())
        
        # Check if we have a requirements.txt
        req_path = next((f for f in updated_fs.keys() if f.endswith('requirements.txt')), None)
        if req_path:
            req_content = updated_fs[req_path]
            existing_reqs = set(re.findall(r"^([\w\-]+)", req_content, re.MULTILINE))
            
            missing = all_imports - existing_reqs
            # Filter out local project modules from 'missing'
            project_modules = {os.path.splitext(os.path.basename(f))[0].lower() for f in updated_fs.keys()}
            missing = missing - project_modules
            
            # Map common import names to pip package names
            package_map = {
                'yaml': 'PyYAML',
                'cv2': 'opencv-python',
                'sklearn': 'scikit-learn',
                'pil': 'Pillow',
                'bs4': 'beautifulsoup4',
                'dotenv': 'python-dotenv',
                'ipython': 'ipython'
            }
            
            mapped_missing = set()
            for m in missing:
                mapped_missing.add(package_map.get(m, m))
                
            # Filter against existing reqs again just in case the mapped name was already there
            mapped_missing = mapped_missing - set(r.lower() for r in existing_reqs)
            
            if mapped_missing:
                self.log(f"     [+] Found missing dependencies: {list(mapped_missing)}. Updating {req_path}...")
                new_reqs = req_content.strip() + "\n" + "\n".join(list(mapped_missing)) + "\n"
                updated_fs[req_path] = new_reqs
        
        return updated_fs

    def format_for_frontend(self, execution_plan: list[str], audit_ledger: list[dict], patch_plan: GlobalPatchPlan | None) -> dict:
        """Standard frontend formatting."""
        results = []
        queue = []
        ledger_map = {item['file_path']: item for item in audit_ledger}
        patch_map = {fp.file_path: fp for fp in patch_plan.files_to_patch} if patch_plan else {}
            
        for file_path in execution_plan:
            audit_info = ledger_map.get(file_path)
            patch_info = patch_map.get(file_path)
            issues = audit_info.get('vulnerabilities', []) if audit_info else []
            
            status = 'clean'
            if audit_info:
                if issues: status = 'edited' if patch_info else 'skipped'
                else: status = 'clean'
            else: status = 'skipped'
                    
            results.append(FrontendAuditFileResult(
                file_path=file_path,
                status=status,
                issues=issues,
                edited=bool(patch_info),
                rationale="Remediated via Full-Rewrite." if patch_info else "No issues.",
                breaking_changes=[]
            ))
            
            if patch_info:
                queue.append(FrontendApprovalItem(
                    file_path=file_path,
                    rationale="Self-healed remediation",
                    issues_fixed=issues
                ))
                
        summary = FrontendAuditSummary(
            total_files=len(execution_plan),
            files_edited=len(patch_map),
            files_clean=len([r for r in results if r.status == 'clean']),
            files_with_issues=len([r for r in results if r.issues]),
            edits_rejected=0
        )
        
        return FrontendAuditData(audit_results=results, approval_queue=queue, summary=summary).model_dump()