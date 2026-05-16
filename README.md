# 🛡️ **`Project`: _Agentic Code Auditor_**
<div align="center">

### 🤖 `Autonomous Multi-Agent Pipeline`: **“An interactive, human-in-the-loop system for autonomous code auditing and patching.”** <br>

</div>

<br>

<img src="./assets/hero_placeholder.png" width="70%" align="right" style="border-radius: 29px; margin-left: 20px;" alt="Dashboard Preview">
<div style="border-left: 4px solid #4CAF50; padding-left: 12px; margin: 12px 0; font-size: 16px;">
🚀 <b>This project provides a powerful, interactive web UI for monitoring a 4-agent LLM pipeline that autonomously analyzes, plans, audits, and patches codebases.</b>
</div>

<br>

<div style="border-left: 4px solid #2196F3; padding-left: 12px; margin: 12px 0; font-size: 16px;">
🧠 <b>The <i>Backend</i> is powered by FastAPI, seamlessly orchestrating agents to process local directories or directly clone and evaluate GitHub repositories.</b>
</div>

<br>

<div style="border-left: 4px solid #FF9800; padding-left: 12px; margin: 12px 0; font-size: 16px;">
🛡️ <b>Features a strict <i>Human-in-the-Loop</i> approval queue, ensuring developers review and authorize all AI-generated patches before they are safely written to disk.</b>
</div>

<div style="clear: both;"></div>

---

<br>

<div align="left">

# 🗂️ Project Structure

<br>

</div>

```markdown-tree
📁 Agentic_Code_Auditor/
├── 📁 backend/                    # FastAPI backend and AI Agent logic
│   ├── main.py                    # API Endpoints & pipeline orchestration
│   ├── agent1.py                  # Architect: Repository analysis & blueprints
│   ├── agent2.py                  # Planner: Execution sequence generation
│   ├── agent3.py                  # Auditor: 3-pass auditing & patch generation
│   ├── agent4.py                  # Reviewer: Patch approval queue & health checks
│   ├── base_agent.py              # Base class for LLM interactions
│   └── domain_models.py           # Pydantic schemas for structured data
│
├── 📁 frontend/                   # React + Vite frontend dashboard
│   ├── package.json
│   ├── tailwind.config.js         # UI Styling
│   └── 📁 src/                    # Framer-Motion animations & React components
│
├── 📁 .vscode/                    
│   └── tasks.json                 # Pre-configured tasks for 1-click execution
│
├── api_keys.txt                   # Local storage for LLM API keys
└── README.md                      
```

<br>

<div align="left">

# ⚙️ **The 4-Agent Pipeline**

</div>

---

<div align="left"; style="display: flex; align-items: flex-start; justify-content: space-between; gap: 30px; flex-wrap: wrap;">

  <!-- LEFT SIDE -->
  <div style="flex: 1; min-width: 320px;">

  <h3>🤖 <b>Pipeline Architecture</b></h3>

  <ul>
    <li><b>Agent 1 (Architect)</b> — Evaluates the target repository, generates a structural blueprint, and discovers protected public interfaces.</li>
    <li><b>Agent 2 (Planner)</b> — Ingests the blueprint to create a strict execution sequence for safe auditing.</li>
    <li><b>Agent 3 (Auditor & Patcher)</b> — Executes a 3-pass system: (1) Audit Files, (2) Generate Patch Plan, and (3) Execute Patches (creates `.bak` backups).</li>
    <li><b>Agent 4 (Reviewer)</b> — Manages the human-in-the-loop approval queue and runs terminal health checks to verify patches.</li>
  </ul>

  <h3>🎨 <b>Frontend Dashboard</b></h3>

  <ul>
    <li><b>Live Streaming Logs</b> — Watch the agents "think" and execute in real-time via the FastAPI backend.</li>
    <li><b>Patch Review UI</b> — Inspect proposed code changes before they are applied.</li>
    <li><b>API Key Management</b> — Securely enter and manage LLM API keys directly from the UI.</li>
  </ul>

</div>
</div>

---

<br>

---

<div align="left">

# 🚀 Getting Started

</div>

---

### **📋 1. Prerequisites**

Before you begin, ensure you have the following installed:

*   **Python 3.11+**: For the FastAPI backend and AI agents.
*   **Node.js & npm**: For the Vite/React frontend.
*   **API Keys**: You will need an API key for your chosen LLM (e.g., Groq) to power the agents.

---

### **⚙️ 2. Installation & Setup**

**1. Clone the Repository**  

```bash
git clone https://github.com/YourUsername/Agentic_Code_Auditor.git
cd Agentic_Code_Auditor
```

**2. Setup the Backend**  

Open a terminal in the root directory and run:

```bash
cd backend
python -m venv .venv
# Activate environment (Windows)
.venv\Scripts\activate
# Activate environment (Mac/Linux)
# source .venv/bin/activate

pip install -r requirements.txt
```

**3. Setup the Frontend**  

Open a second terminal in the root directory and run:

```bash
cd frontend
npm install
```

---

### **🛰️ 3. Launch the Application!**

**✨ The "Quick Start" Method (VS Code Only):**
Since the project includes a configured `.vscode/tasks.json`, you can launch everything with a single shortcut:
1. Open the project folder in VS Code.
2. Press **`Ctrl + Shift + B`** to run the "Start Full Project" task. This will start both the backend and frontend simultaneously.

**Manual Launch Method:**
If you prefer the terminal, you will need two active terminal windows:

*   **Terminal 1 (Backend):**
    ```bash
    cd backend
    .venv\Scripts\activate  # Windows
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

*   **Terminal 2 (Frontend):**
    ```bash
    cd frontend
    npm run dev
    ```

Your React dashboard will now be live on `http://localhost:5173` (or the port specified by Vite)!

---
<div align="center">
<i>Built for Autonomous Auditing.</i>
</div>
