from pydantic import BaseModel, Field
from typing import List, Literal

# ── Agent 1 Models (The Filter) ─────────────────────────────────

class FolderDecision(BaseModel):
    folder_name: str = Field(description="The name of the folder being evaluated.")
    should_traverse: bool = Field(description="True if we should traverse into this folder, False to skip.")
    reason: str = Field(description="A brief explanation of why this decision was made.")

class DirectoryEvaluation(BaseModel):
    files_to_include: list[str] = Field(description="List of exact file names from the directory that should be included.")
    folders_to_traverse: list[FolderDecision] = Field(description="Decisions on which sub-folders to dive into.")


# ── Agent 2 Models (The Sequencer) ──────────────────────────────

class ExecutionNode(BaseModel):
    file_path: str = Field(description="The exact file path to be analyzed.")
    dependencies: list[str] = Field(description="Other files in this repository that must be analyzed BEFORE this file.")

class Agent2ExecutionPlan(BaseModel):
    execution_sequence: list[ExecutionNode] = Field(description="A strictly ordered array of files representing the execution flow.")


# ── Agent 3 Models (The Multi-Pass Auditor) ─────────────────────

# Pass 1: The Audit
class FileAudit(BaseModel):
    file_path: str = Field(description="The exact file path provided in the prompt.")
    vulnerabilities: list[str] = Field(description="List of security or logic flaws found. Empty if none. Must be simple strings.")
    proposed_fixes: list[str] = Field(description="High-level description of what needs to change. NO CODE. Must be simple strings.")

# Pass 2: The Global Reconciliation & Patch Plan
class FilePatch(BaseModel):
    file_path: str = Field(description="The exact file path to patch.")
    diff_content: str = Field(description="The Unified Diff content to apply to the file.")

class GlobalPatchPlan(BaseModel):
    plan_rationale: str = Field(description="Explanation of how these fixes work together across multiple files.")
    files_to_patch: list[FilePatch] = Field(description="The list of files that require surgical patches.")


# ── Frontend Output Models (Bridge for App.tsx) ─────────────────

class FrontendAuditFileResult(BaseModel):
    file_path: str
    status: Literal['clean', 'edited', 'rejected', 'skipped', 'error']
    issues: List[str]
    edited: bool
    rationale: str
    breaking_changes: List[str]

class FrontendApprovalItem(BaseModel):
    file_path: str
    rationale: str
    issues_fixed: List[str]

class FrontendAuditSummary(BaseModel):
    total_files: int
    files_edited: int
    files_clean: int
    files_with_issues: int
    edits_rejected: int

class FrontendAuditData(BaseModel):
    audit_results: List[FrontendAuditFileResult]
    approval_queue: List[FrontendApprovalItem]
    summary: FrontendAuditSummary