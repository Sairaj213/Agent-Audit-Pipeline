from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import sys

from utils import clone_github_repo, load_filesystem_context, save_state, get_state, clear_state
from agent1 import Agent1
from agent2 import Agent2
from agent3 import Agent3
from agent4 import Agent4
from key_manager import key_manager

app = FastAPI(title="Agentic Pipeline API")

# Allow React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to ["http://localhost:3000", "http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-Memory State for Frontend Polling ────────────────────────

# This tracks the live status, logs, and final results for the UI
ui_state = {
    "agent1": {"status": "idle", "logs": [], "result": None},
    "agent2": {"status": "idle", "logs": [], "result": None},
    "agent3": {"status": "idle", "logs": [], "result": None},
    "agent4": {"status": "idle", "logs": [], "patches": [], "summary": None},
}

agent4_instance = None

def reset_ui_state(agent_key: str):
    ui_state[agent_key] = {"status": "running", "logs": [], "result": None}

def append_log(agent_key: str, message: str):
    ui_state[agent_key]["logs"].append(message)
    print(f"[{agent_key.upper()}] {message}")

# ── Request Models ──────────────────────────────────────────────

class Agent1Request(BaseModel):
    target_path: str
    model_name: str
    api_key: Optional[str] = None

class AgentRequest(BaseModel):
    model_name: str
    api_key: Optional[str] = None
    fix_request: Optional[dict] = None

class PatchDecisionRequest(BaseModel):
    file_path: str
    decision: str  # "approve" or "reject"

class HealthCheckRequest(BaseModel):
    verify_cmd: str

# ── Background Tasks (Agent Execution) ──────────────────────────

def run_agent1(target_path: str, model_name: str, api_key: str = None):
    agent_key = "agent1"
    try:
        if api_key: key_manager.set_active_key(api_key)
        # 1. Handle GitHub URL vs Local Path
        if target_path.startswith("http"):
            append_log(agent_key, f"Detected GitHub URL. Initiating clone...")
            local_dir = clone_github_repo(target_path, lambda msg: append_log(agent_key, msg))
            if not local_dir:
                ui_state[agent_key]["status"] = "error"
                return
        else:
            local_dir = os.path.abspath(target_path)
            append_log(agent_key, f"Using local directory: {local_dir}")

        # Save the resolved path for Agent 2 and 3
        save_state("target_dir", local_dir)

        # 2. Run Agent 1
        agent = Agent1(
            root_path=local_dir, 
            model_name=model_name, 
            log_callback=lambda msg: append_log(agent_key, msg)
        )
        blueprint = agent.run()
        
        # 3. Save state and complete
        save_state("blueprint", blueprint)
        ui_state[agent_key]["result"] = blueprint
        ui_state[agent_key]["status"] = "completed"
        append_log(agent_key, "[SUCCESS] Agent 1 Pipeline Completed.")
        
    except Exception as e:
        append_log(agent_key, f"[FATAL] {str(e)}")
        ui_state[agent_key]["status"] = "error"

def run_agent2(model_name: str, api_key: str = None):
    agent_key = "agent2"
    try:
        if api_key: key_manager.set_active_key(api_key)
        blueprint = get_state("blueprint")
        if not blueprint:
            raise ValueError("No blueprint found. Please run Agent 1 first.")

        agent = Agent2(
            blueprint=blueprint, 
            model_name=model_name, 
            log_callback=lambda msg: append_log(agent_key, msg)
        )
        plan = agent.run()
        
        if plan:
            # 🔄 FIX: Safely handle both Pydantic models (v1 & v2) and standard dictionaries
            if hasattr(plan, "model_dump"):
                plan_dict = plan.model_dump()
            elif hasattr(plan, "dict"):
                plan_dict = plan.dict()
            else:
                plan_dict = plan  # It's already a dictionary!
                
            save_state("execution_plan", plan_dict)
            ui_state[agent_key]["result"] = plan_dict
            ui_state[agent_key]["status"] = "completed"
        else:
            ui_state[agent_key]["status"] = "error"
            
    except Exception as e:
        append_log(agent_key, f"[FATAL] {str(e)}")
        ui_state[agent_key]["status"] = "error"

def run_agent3(model_name: str, api_key: str = None, fix_request: dict = None):
    agent_key = "agent3"
    try:
        if api_key: key_manager.set_active_key(api_key)
        target_dir = get_state("target_dir")
        plan_dict = get_state("execution_plan")
        
        if not target_dir or not plan_dict:
            raise ValueError("Missing context. Please run Agents 1 and 2 first.")

        # Extract strict execution sequence
        execution_sequence = [node["file_path"] for node in plan_dict.get("execution_sequence", [])]
        
        # Load the files into memory
        filesystem = load_filesystem_context(
            target_dir, 
            execution_sequence, 
            lambda msg: append_log(agent_key, msg)
        )

        # Determine the python executable for verification
        python_exe = os.path.abspath(".venv/Scripts/python.exe") if os.name == 'nt' else os.path.abspath(".venv/bin/python")
        if not os.path.exists(python_exe):
            python_exe = sys.executable

        agent = Agent3(
            model_name=model_name, 
            api_key=api_key,
            log_callback=lambda msg: append_log(agent_key, msg),
            python_exe=python_exe,
            fix_request=fix_request
        )

        # Discover Protected Interfaces (Names imported by other files)
        temp_a1 = Agent1(root_path=target_dir, model_name=model_name, log_callback=lambda msg: append_log(agent_key, msg))
        protected_interfaces = temp_a1.discover_public_interfaces(filesystem)

        # Execute 3-Pass Pipeline
        audit_ledger = agent.pass_1_audit_files(execution_sequence, filesystem)
        patch_plan = agent.pass_2_generate_patch_plan(audit_ledger, filesystem, target_dir=target_dir, protected_interfaces=protected_interfaces)
        
        if patch_plan:
            updated_fs = agent.pass_3_execute_patches(patch_plan, filesystem)
            
            # Physical Persistence with .bak creation
            import shutil
            append_log(agent_key, "[INFO] Persisting changes with .bak backups...")
            for rel_path, content in updated_fs.items():
                abs_path = os.path.join(target_dir, rel_path.lstrip("\\/"))
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                
                # Create backup if it doesn't exist
                if os.path.exists(abs_path) and not os.path.exists(abs_path + ".bak"):
                    shutil.copy2(abs_path, abs_path + ".bak")
                
                with open(abs_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            
            append_log(agent_key, "[SUCCESS] Patches persisted to disk. Backups created for review.")

        # Format the output to exactly match the React Frontend's expectations
        frontend_result = agent.format_for_frontend(execution_sequence, audit_ledger, patch_plan)
        
        ui_state[agent_key]["result"] = frontend_result
        ui_state[agent_key]["status"] = "completed"
        append_log(agent_key, "🎉 Agent 3 Pipeline Complete.")
        
    except Exception as e:
        append_log(agent_key, f"[FATAL] {str(e)}")
        ui_state[agent_key]["status"] = "error"

# ── API Endpoints ───────────────────────────────────────────────

@app.post("/api/agent1/start")
async def start_agent1(req: Agent1Request, bg_tasks: BackgroundTasks):
    clear_state() # Start fresh
    reset_ui_state("agent1")
    # Reset subsequent agents
    ui_state["agent2"] = {"status": "idle", "logs": [], "result": None}
    ui_state["agent3"] = {"status": "idle", "logs": [], "result": None}
    
    bg_tasks.add_task(run_agent1, req.target_path, req.model_name, req.api_key)
    return {"message": "Agent 1 started"}

@app.get("/api/agent1/status")
async def get_agent1_status():
    return ui_state["agent1"]

@app.post("/api/agent2/start")
async def start_agent2(req: AgentRequest, bg_tasks: BackgroundTasks):
    reset_ui_state("agent2")
    ui_state["agent3"] = {"status": "idle", "logs": [], "result": None}
    
    bg_tasks.add_task(run_agent2, req.model_name, req.api_key)
    return {"message": "Agent 2 started"}

@app.get("/api/agent2/status")
async def get_agent2_status():
    return ui_state["agent2"]

@app.post("/api/agent3/start")
async def start_agent3(req: AgentRequest, bg_tasks: BackgroundTasks):
    reset_ui_state("agent3")
    bg_tasks.add_task(run_agent3, req.model_name, req.api_key, req.fix_request)
    return {"message": "Agent 3 started"}

@app.get("/api/agent3/status")
async def get_agent3_status():
    return ui_state["agent3"]

# ── Agent 4 Endpoints ───────────────────────────────────────────

@app.post("/api/agent4/prepare")
def prepare_agent4():
    global agent4_instance
    agent_key = "agent4"
    
    a3_result = ui_state["agent3"]["result"]
    if not a3_result:
        return {"error": "Agent 3 result not found"}
        
    target_dir = get_state("target_dir")
    approval_queue = a3_result.get("approval_queue", [])
    
    reset_ui_state(agent_key)
    ui_state[agent_key]["status"] = "reviewing"
    ui_state[agent_key]["patches"] = []
    ui_state[agent_key]["summary"] = None
    
    agent4_instance = Agent4(
        approval_queue=approval_queue,
        target_path=target_dir,
        log_callback=lambda msg: append_log(agent_key, msg)
    )
    
    patches = agent4_instance.prepare_patches()
    summary = agent4_instance.get_summary()
    
    ui_state[agent_key]["patches"] = patches
    ui_state[agent_key]["summary"] = summary
    
    if not patches:
        ui_state[agent_key]["status"] = "completed"
        
    return {"patches": patches, "summary": summary}

@app.post("/api/agent4/decide")
def decide_patch(req: PatchDecisionRequest):
    global agent4_instance
    if not agent4_instance:
        return {"error": "Agent 4 not initialized"}
        
    result = agent4_instance.apply_decision(req.file_path, req.decision)
    summary = agent4_instance.get_summary()
    
    ui_state["agent4"]["summary"] = summary
    if summary["is_complete"]:
        ui_state["agent4"]["status"] = "completed"
        append_log("agent4", "All patches reviewed.")
        
    return {"result": result, "summary": summary}

@app.get("/api/agent4/status")
def get_agent4_status():
    return ui_state["agent4"]

# ── Settings & API Key Management ──────────────────────────────

@app.get("/api/settings/keys")
def get_api_keys():
    """Read keys from api_keys.txt"""
    if not os.path.exists("api_keys.txt"):
        return {"keys": []}
    with open("api_keys.txt", "r") as f:
        keys = [line.strip() for line in f if line.strip()]
    return {"keys": keys}

@app.post("/api/settings/keys")
def save_api_keys(data: dict):
    """Write keys to api_keys.txt"""
    keys = data.get("keys", [])
    with open("api_keys.txt", "w") as f:
        for key in keys:
            f.write(f"{key}\n")
    key_manager.reload()
    return {"success": True}

@app.post("/api/agent4/health")
def run_agent4_health(req: HealthCheckRequest):
    global agent4_instance
    if not agent4_instance:
        return {"healthy": False, "error": "Agent 4 instance not initialized"}
    
    result = agent4_instance.run_health_check(req.verify_cmd)
    return result