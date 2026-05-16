import os
import json
import shutil
import difflib

class Agent4:
    """
    Agent 4: Human-in-the-Loop Patch Reviewer.
    Calculates diffs between .bak and modified files for UI review.
    """

    def __init__(self, approval_queue: list, target_path: str, log_callback=None):
        self.approval_queue = approval_queue
        self.target_path = os.path.abspath(target_path)
        self.log_callback = log_callback or (lambda x: None)
        self.patches = []
        self.decisions = {} # file_path -> "approve" | "reject"

    def log(self, msg: str):
        self.log_callback(msg)

    def compute_diff(self, old_text: str, new_text: str, file_name: str) -> list[dict]:
        """Compute unified diff and return structured diff lines for the frontend."""
        diff_lines = list(difflib.unified_diff(
            old_text.splitlines(),
            new_text.splitlines(),
            fromfile=f"original/{file_name}",
            tofile=f"updated/{file_name}",
            lineterm=""
        ))

        structured = []
        for line in diff_lines:
            if line.startswith("+++") or line.startswith("---"):
                structured.append({"type": "header", "content": line})
            elif line.startswith("@@"):
                structured.append({"type": "hunk", "content": line})
            elif line.startswith("+") and not line.startswith("+++"):
                structured.append({"type": "add", "content": line})
            elif line.startswith("-") and not line.startswith("---"):
                structured.append({"type": "remove", "content": line})
            else:
                structured.append({"type": "context", "content": line})

        return structured

    def prepare_patches(self) -> list[dict]:
        """Prepare all patches with diff data for the frontend."""
        if not self.approval_queue:
            return []

        patches = []
        for idx, patch in enumerate(self.approval_queue):
            rel_path = patch["file_path"]
            abs_path = os.path.join(self.target_path, rel_path.lstrip("\\/"))
            bak_path = abs_path + ".bak"

            if not os.path.exists(abs_path) or not os.path.exists(bak_path):
                self.log(f"  [SKIP] Missing backup for {rel_path}")
                continue

            try:
                with open(bak_path, "r", encoding="utf-8") as f:
                    old_content = f.read()
                with open(abs_path, "r", encoding="utf-8") as f:
                    new_content = f.read()
            except Exception as e:
                self.log(f"  [ERROR] Could not read files for {rel_path}: {e}")
                continue

            diff_lines = self.compute_diff(old_content, new_content, rel_path)
            additions = sum(1 for d in diff_lines if d["type"] == "add")
            deletions = sum(1 for d in diff_lines if d["type"] == "remove")

            patches.append({
                "index": idx,
                "file_path": rel_path,
                "rationale": patch.get("rationale", "Remediated by Agent 3"),
                "issues_fixed": patch.get("issues_fixed", []),
                "status": "pending",
                "diff_lines": diff_lines,
                "stats": {"additions": additions, "deletions": deletions}
            })

        self.patches = patches
        return patches

    def apply_decision(self, file_path: str, decision: str) -> dict:
        """Apply approve/reject decision for a single patch."""
        abs_path = os.path.join(self.target_path, file_path.lstrip("\\/"))
        bak_path = abs_path + ".bak"

        if decision == "approve":
            if os.path.exists(bak_path):
                os.remove(bak_path)
            self.decisions[file_path] = "approve"
            return {"file_path": file_path, "decision": "approve", "success": True}

        elif decision == "reject":
            if os.path.exists(bak_path):
                shutil.copy2(bak_path, abs_path)
                os.remove(bak_path)
            self.decisions[file_path] = "reject"
            return {"file_path": file_path, "decision": "reject", "success": True}

        return {"file_path": file_path, "success": False, "error": "Invalid decision"}

    def get_summary(self) -> dict:
        approved = [fp for fp, d in self.decisions.items() if d == "approve"]
        rejected = [fp for fp, d in self.decisions.items() if d == "reject"]
        pending = [p["file_path"] for p in self.patches if p["file_path"] not in self.decisions]

        return {
            "total_patches": len(self.patches),
            "approved_count": len(approved),
            "rejected_count": len(rejected),
            "pending_count": len(pending),
            "is_complete": len(pending) == 0,
            "approved_files": approved,
            "rejected_files": rejected
        }

    def run_health_check(self, verify_cmd: str) -> dict:
        """Execute a verification command and return the health status."""
        import subprocess
        self.log(f"[INFO] Running health check: {verify_cmd}")
        
        try:
            # Use the virtualenv if available
            env = os.environ.copy()
            # If we're on windows and .venv exists, try to use it
            venv_bin = os.path.join(self.target_path, ".venv", "Scripts" if os.name == "nt" else "bin")
            if os.path.exists(venv_bin):
                env["PATH"] = venv_bin + os.pathsep + env.get("PATH", "")
                env["VIRTUAL_ENV"] = os.path.join(self.target_path, ".venv")

            process = subprocess.run(
                verify_cmd,
                shell=True,
                cwd=self.target_path,
                capture_output=True,
                text=True,
                timeout=60,
                env=env
            )
            
            healthy = process.returncode == 0
            output = process.stdout + "\n" + process.stderr
            
            if not healthy:
                self.log(f"  [FAIL] Health check failed with return code {process.returncode}")
                # Create a fix request for Agent 3
                fix_request = {
                    "error_type": "RuntimeError",
                    "error_message": output[-2000:], # Last 2000 chars
                    "command": verify_cmd
                }
                return {"healthy": False, "output": output, "fix_request": fix_request}
            
            self.log("  [PASS] Project is healthy.")
            return {"healthy": True, "output": output}
            
        except subprocess.TimeoutExpired:
            self.log("  [ERROR] Health check timed out.")
            return {"healthy": False, "error": "Verification command timed out after 60 seconds."}
        except Exception as e:
            self.log(f"  [ERROR] Health check execution failed: {str(e)}")
            return {"healthy": False, "error": str(e)}
