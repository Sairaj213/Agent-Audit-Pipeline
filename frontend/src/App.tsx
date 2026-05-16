import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, ArrowRight, FolderGit2, Activity, Map, Workflow, ChevronRight, Zap, Shield, CheckCircle2, Settings, GitPullRequestArrow } from 'lucide-react';
import LogsTerminal from './components/LogsTerminal';
import TreeView from './components/TreeView';
import ExecutionPlanView from './components/ExecutionPlanView';
import AuditResultsView from './components/AuditResultsView';
import PatchReviewView from './components/PatchReviewView';
import SettingsModal from './components/SettingsModal';

const API = 'http://localhost:8000';

type AgentStage = 'agent1' | 'agent2' | 'agent3' | 'agent4';

export default function App() {
  // ── Global ────────────────────────────────────────────────────
  const [activeStage, setActiveStage] = useState<AgentStage>('agent1');
  const [targetPath, setTargetPath] = useState('');
  const [modelName, setModelName] = useState('groq/llama-3.3-70b-versatile');
  const [apiKey, setApiKey] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('groq');

  // Load saved API configuration on mount
  const loadApiConfig = () => {
    const saved = localStorage.getItem('llm_configs');
    if (saved) {
      try {
        const configs = JSON.parse(saved);
        const activeConfig = configs.find((c: any) => c.isActive);
        if (activeConfig) {
          setApiKey(activeConfig.apiKey);
          setModelName(activeConfig.modelName);
          setActiveProvider(activeConfig.provider);
        }
      } catch (e) {
        console.error('Failed to load API config', e);
      }
    }
  };

  useEffect(() => {
    loadApiConfig();
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      loadApiConfig();
    }
  }, [settingsOpen]);

  // ── Agent 1 State ─────────────────────────────────────────────
  const [a1Tab, setA1Tab] = useState<'logs' | 'tree'>('logs');
  const [a1Status, setA1Status] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [a1Logs, setA1Logs] = useState<string[]>([]);
  const [a1Tree, setA1Tree] = useState<any>(null);

  // ── Agent 2 State ─────────────────────────────────────────────
  const [a2Tab, setA2Tab] = useState<'logs' | 'plan'>('logs');
  const [a2Status, setA2Status] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [a2Logs, setA2Logs] = useState<string[]>([]);
  const [a2Plan, setA2Plan] = useState<any>(null);

  // ── Agent 3 State ─────────────────────────────────────────────
  const [a3Tab, setA3Tab] = useState<'logs' | 'audit'>('logs');
  const [a3Status, setA3Status] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [a3Logs, setA3Logs] = useState<string[]>([]);
  const [a3Result, setA3Result] = useState<any>(null);
  
  // ── Agent 4 State ─────────────────────────────────────────────
  const [a4Status, setA4Status] = useState<'idle' | 'reviewing' | 'completed' | 'error'>('idle');
  const [a4Patches, setA4Patches] = useState<any[]>([]);
  const [a4Summary, setA4Summary] = useState<any>(null);

  // ── Polling: Agent 1 ──────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (a1Status === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/agent1/status`);
          const data = await res.json();
          setA1Logs(data.logs);
          setA1Status(data.status);
          if (data.result) {
            setA1Tree(data.result);
            setA1Tab('tree');
          }
        } catch (e) { console.error("Agent 1 polling error", e); }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [a1Status]);

  // ── Polling: Agent 2 ──────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (a2Status === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/agent2/status`);
          const data = await res.json();
          setA2Logs(data.logs);
          setA2Status(data.status);
          if (data.result) {
            setA2Plan(data.result);
            setA2Tab('plan');
          }
        } catch (e) { console.error("Agent 2 polling error", e); }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [a2Status]);

  // ── Polling: Agent 3 ──────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (a3Status === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/agent3/status`);
          const data = await res.json();
          setA3Logs(data.logs);
          setA3Status(data.status);
          if (data.result) {
            setA3Result(data.result);
            setA3Tab('audit');
          }
        } catch (e) { console.error("Agent 3 polling error", e); }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [a3Status]);

  // ── Polling: Agent 4 ──────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (a4Status === 'reviewing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/agent4/status`);
          const data = await res.json();
          setA4Status(data.status);
          setA4Patches(data.patches || []);
          setA4Summary(data.summary);
        } catch (e) { console.error("Agent 4 polling error", e); }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [a4Status]);

  // ── Start Agent 1 ─────────────────────────────────────────────
  const startAgent1 = async () => {
    if (!targetPath.trim()) return;
    setA1Status('running');
    setA1Logs([]);
    setA1Tree(null);
    setA1Tab('logs');
    // Reset downstream agents
    setA2Status('idle'); setA2Logs([]); setA2Plan(null);
    setA3Status('idle'); setA3Logs([]); setA3Result(null);
    setA4Status('idle'); setA4Patches([]); setA4Summary(null);

    try {
      await fetch(`${API}/api/agent1/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_path: targetPath, model_name: modelName })
      });
    } catch (e) {
      setA1Status('error');
      setA1Logs(prev => [...prev, "[FATAL] Backend disconnected."]);
    }
  };

  // ── Start Agent 2 ─────────────────────────────────────────────
  const startAgent2 = async () => {
    setA2Status('running');
    setA2Logs([]);
    setA2Plan(null);
    setA2Tab('logs');
    // Reset Agent 3
    setA3Status('idle'); setA3Logs([]); setA3Result(null);
    setActiveStage('agent2');

    try {
      await fetch(`${API}/api/agent2/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
      });
    } catch (e) {
      setA2Status('error');
      setA2Logs(prev => [...prev, "[FATAL] Backend disconnected."]);
    }
  };

  // ── Start Agent 3 ─────────────────────────────────────────────
  const startAgent3 = async () => {
    setA3Status('running');
    setA3Logs([]);
    setA3Result(null);
    setA3Tab('logs');
    setActiveStage('agent3');

    try {
      await fetch(`${API}/api/agent3/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
      });
    } catch (e) {
      setA3Status('error');
      setA3Logs(prev => [...prev, "[FATAL] Backend disconnected."]);
    }
  };

  // ── Start Agent 4 ─────────────────────────────────────────────
  const startAgent4 = async () => {
    setA4Status('reviewing');
    setActiveStage('agent4');
    try {
      const res = await fetch(`${API}/api/agent4/prepare`, { method: 'POST' });
      const data = await res.json();
      if (data.patches) {
        setA4Patches(data.patches);
        setA4Summary(data.summary);
      }
    } catch (e) {
      setA4Status('error');
    }
  };

  const canStartAgent2 = a1Status === 'completed' && a1Tree;
  const canStartAgent3 = a2Status === 'completed' && a2Plan;

  const canSwitchTo = (stage: AgentStage): boolean => {
    if (stage === 'agent1') return true;
    if (stage === 'agent2') return !!(canStartAgent2 || a2Status !== 'idle');
    if (stage === 'agent3') return !!(canStartAgent3 || a3Status !== 'idle');
    if (stage === 'agent4') return !!(a3Status === 'completed' || a4Status !== 'idle');
    return false;
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] text-stone-800 selection:bg-nobel-gold selection:text-white">

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F9F8F4]/90 backdrop-blur-md shadow-sm border-b border-stone-200">
        <div className="container mx-auto px-6 flex items-center gap-4 h-16">
          <div className="w-8 h-8 bg-nobel-gold rounded-full flex items-center justify-center text-white font-serif font-bold text-xl shadow-sm pb-1">α</div>
          <span className="font-serif font-bold text-lg tracking-wide">PIPELINE</span>

          {/* Stage Switcher */}
          <div className="ml-6 flex items-center bg-stone-100 rounded-full p-1 border border-stone-200">
            {(['agent1', 'agent2', 'agent3', 'agent4'] as AgentStage[]).map((stage, idx) => (
              <React.Fragment key={stage}>
                {idx > 0 && <ChevronRight size={14} className="text-stone-300 mx-0.5" />}
                <button
                  onClick={() => canSwitchTo(stage) && setActiveStage(stage)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    activeStage === stage
                      ? 'bg-white text-stone-900 shadow-sm'
                      : canSwitchTo(stage)
                        ? 'text-stone-500 hover:text-stone-700 cursor-pointer'
                        : 'text-stone-300 cursor-not-allowed'
                  }`}
                >
                  Agent {idx + 1}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Status indicators */}
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-stone-100 rounded-lg transition-all group"
              title="Configure Intelligence Core"
            >
              <Settings size={18} className="text-stone-400 group-hover:text-nobel-gold transition-colors" />
            </button>
            
            <div className="flex items-center gap-1 px-3 py-1 bg-stone-100 rounded-md">
               <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{activeProvider}</span>
            </div>

            <div className="w-px h-4 bg-stone-200 mx-1"></div>
            
            <div className="flex items-center gap-2">
              <StatusPill label="A1" status={a1Status} />
              <StatusPill label="A2" status={a2Status} />
              <StatusPill label="A3" status={a3Status} />
              <StatusPill label="A4" status={a4Status === 'reviewing' ? 'running' : a4Status} />
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ═══════════════════════ AGENT 1 ═══════════════════════ */}
        {activeStage === 'agent1' && (
          <motion.main
            key="agent1"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="pt-28 pb-12 px-6 container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
          >
            {/* Left Column */}
            <div className="lg:col-span-4 flex flex-col justify-center mt-8">
              <div className="inline-block mb-3 text-xs font-bold tracking-widest text-stone-500 uppercase">Phase 01 — System Ingestion</div>
              <h1 className="font-serif text-5xl text-stone-900 leading-tight mb-6">
                Repository <br /><span className="italic font-normal text-stone-500 text-4xl mt-2 block">Architecture Map</span>
              </h1>
              <div className="w-16 h-1 bg-nobel-gold mb-8 opacity-80"></div>

              <p className="text-lg text-stone-600 mb-10 leading-relaxed font-light">
                Provide a local directory path or a GitHub URL. Agent 1 will autonomously traverse the structure, evaluate significance using LLMs, and architect a highly distilled blueprint.
              </p>

              <div className="space-y-6 bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Target Path / URL</label>
                  <div className="relative">
                    <FolderGit2 className="absolute left-3 top-3.5 text-stone-400" size={18} />
                    <input
                      type="text"
                      value={targetPath}
                      onChange={(e) => setTargetPath(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="w-full pl-10 pr-4 py-3 bg-[#F9F8F4] border border-stone-200 rounded-lg focus:outline-none focus:border-nobel-gold focus:ring-1 focus:ring-nobel-gold transition-colors"
                      disabled={a1Status === 'running'}
                    />
                  </div>
                </div>

                <ModelSelector modelName={modelName} setModelName={setModelName} disabled={a1Status === 'running'} onOpenSettings={() => setSettingsOpen(true)} />

                <button
                  onClick={startAgent1}
                  disabled={a1Status === 'running' || !targetPath}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm ${a1Status === 'running' ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-stone-900 text-white hover:bg-stone-800 hover:shadow-md'}`}
                >
                  {a1Status === 'running' ? 'Processing...' : 'Commence Analysis'}
                  {a1Status !== 'running' && <ArrowRight size={18} />}
                </button>
              </div>

              {/* Proceed to Agent 2 */}
              {canStartAgent2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6">
                  <button onClick={startAgent2} className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm bg-nobel-gold text-white hover:bg-[#b8933f] hover:shadow-md">
                    <Zap size={18} /> Launch Agent 2 — Execution Sequencer <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </div>

            {/* Right Column */}
            <OutputPanel
              tabs={[
                { id: 'logs', label: 'Terminal Feed', icon: <Activity size={16} /> },
                { id: 'tree', label: 'Architectural Map', icon: <Map size={16} /> },
              ]}
              activeTab={a1Tab}
              onTabChange={(t) => setA1Tab(t as any)}
            >
              {a1Tab === 'logs' ? <LogsTerminal logs={a1Logs} status={a1Status} /> : <TreeView treeData={a1Tree} />}
            </OutputPanel>
          </motion.main>
        )}

        {/* ═══════════════════════ AGENT 2 ═══════════════════════ */}
        {activeStage === 'agent2' && (
          <motion.main
            key="agent2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.3 }}
            className="pt-28 pb-12 px-6 container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
          >
            {/* Left Column */}
            <div className="lg:col-span-4 flex flex-col justify-center mt-8">
              <div className="inline-block mb-3 text-xs font-bold tracking-widest text-stone-500 uppercase">Phase 02 — Dependency Sequencing</div>
              <h1 className="font-serif text-5xl text-stone-900 leading-tight mb-6">
                Execution <br /><span className="italic font-normal text-stone-500 text-4xl mt-2 block">Sequence Plan</span>
              </h1>
              <div className="w-16 h-1 bg-nobel-gold mb-8 opacity-80"></div>

              <p className="text-lg text-stone-600 mb-10 leading-relaxed font-light">
                Agent 2 reads the blueprint from Agent 1, ingests the actual source code, and constructs a strictly ordered execution sequence based on dependency analysis.
              </p>

              <div className="space-y-6 bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Blueprint Input</label>
                  <div className="p-3 bg-[#F9F8F4] rounded-lg border border-stone-200 text-sm text-stone-600 font-mono">
                    {a1Tree ? <span className="text-green-600">✓ {countFiles(a1Tree)} files from Agent 1</span> : <span className="text-stone-400 italic">Waiting for Agent 1...</span>}
                  </div>
                </div>

                <ModelSelector modelName={modelName} setModelName={setModelName} disabled={a2Status === 'running'} />

                <button
                  onClick={startAgent2}
                  disabled={a2Status === 'running' || !canStartAgent2}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm ${
                    a2Status === 'running' || !canStartAgent2 ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-stone-900 text-white hover:bg-stone-800 hover:shadow-md'
                  }`}
                >
                  {a2Status === 'running' ? 'Sequencing...' : a2Status === 'completed' ? 'Re-Sequence' : 'Begin Sequencing'}
                  {a2Status !== 'running' && <Workflow size={18} />}
                </button>

                <button onClick={() => setActiveStage('agent1')} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors border border-stone-200">
                  ← Back to Agent 1
                </button>
              </div>

              {/* Proceed to Agent 3 */}
              {canStartAgent3 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6">
                  <button onClick={startAgent3} className="w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm bg-nobel-gold text-white hover:bg-[#b8933f] hover:shadow-md">
                    <Shield size={18} /> Launch Agent 3 — Security Auditor <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </div>

            {/* Right Column */}
            <OutputPanel
              tabs={[
                { id: 'logs', label: 'Terminal Feed', icon: <Activity size={16} /> },
                { id: 'plan', label: 'Execution Plan', icon: <Workflow size={16} /> },
              ]}
              activeTab={a2Tab}
              onTabChange={(t) => setA2Tab(t as any)}
            >
              {a2Tab === 'logs' ? <LogsTerminal logs={a2Logs} status={a2Status} /> : <ExecutionPlanView planData={a2Plan} />}
            </OutputPanel>
          </motion.main>
        )}

        {/* ═══════════════════════ AGENT 3 ═══════════════════════ */}
        {activeStage === 'agent3' && (
          <motion.main
            key="agent3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.3 }}
            className="pt-28 pb-12 px-6 container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
          >
            {/* Left Column */}
            <div className="lg:col-span-4 flex flex-col justify-center mt-8">
              <div className="inline-block mb-3 text-xs font-bold tracking-widest text-stone-500 uppercase">Phase 03 — Security Audit</div>
              <h1 className="font-serif text-5xl text-stone-900 leading-tight mb-6">
                Safe ReAct <br /><span className="italic font-normal text-stone-500 text-4xl mt-2 block">Code Auditor</span>
              </h1>
              <div className="w-16 h-1 bg-nobel-gold mb-8 opacity-80"></div>

              <p className="text-lg text-stone-600 mb-10 leading-relaxed font-light">
                Agent 3 audits each file in dependency order using AST knowledge graphs. It detects security flaws, performance issues, and propagates breaking changes with atomic rollback safety.
              </p>

              <div className="space-y-6 bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Execution Plan Input</label>
                  <div className="p-3 bg-[#F9F8F4] rounded-lg border border-stone-200 text-sm text-stone-600 font-mono">
                    {a2Plan ? (
                      <span className="text-green-600">✓ {a2Plan.execution_sequence?.length || 0} files from Agent 2</span>
                    ) : (
                      <span className="text-stone-400 italic">Waiting for Agent 2...</span>
                    )}
                  </div>
                </div>

                <ModelSelector modelName={modelName} setModelName={setModelName} disabled={a3Status === 'running'} />

                <button
                  onClick={startAgent3}
                  disabled={a3Status === 'running' || !canStartAgent3}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm ${
                    a3Status === 'running' || !canStartAgent3 ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-stone-900 text-white hover:bg-stone-800 hover:shadow-md'
                  }`}
                >
                  {a3Status === 'running' ? 'Auditing...' : a3Status === 'completed' ? 'Re-Audit' : 'Begin Audit'}
                  {a3Status !== 'running' && <Shield size={18} />}
                </button>

                <button onClick={() => setActiveStage('agent2')} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors border border-stone-200">
                  ← Back to Agent 2
                </button>

                {/* Launch Agent 4 - Corrected Position */}
                {a3Status === 'completed' && a4Status === 'idle' && (
                  <button 
                    onClick={startAgent4} 
                    className="w-full flex items-center justify-center gap-2 py-4 mt-6 rounded-lg font-bold tracking-wider uppercase transition-all shadow-sm bg-nobel-gold text-white hover:bg-[#b8933f] hover:shadow-md"
                  >
                    <GitPullRequestArrow size={18} /> Enter Human Review <ArrowRight size={18} />
                  </button>
                )}
              </div>

              {/* Completion Banner */}
              {a3Status === 'completed' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 shadow-sm">
                  <CheckCircle2 className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h3 className="font-bold text-green-800 text-xs uppercase tracking-wider mb-1">Pipeline Complete</h3>
                    <p className="text-green-700 text-sm leading-relaxed">The security audit and patch synthesis have successfully concluded. Review the final report in the right panel.</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Column */}
            <OutputPanel
              tabs={[
                { id: 'logs', label: 'Terminal Feed', icon: <Activity size={16} /> },
                { id: 'audit', label: 'Audit Report', icon: <Shield size={16} /> },
              ]}
              activeTab={a3Tab}
              onTabChange={(t) => setA3Tab(t as any)}
            >
              {a3Tab === 'logs' ? <LogsTerminal logs={a3Logs} status={a3Status} /> : <AuditResultsView auditData={a3Result} />}
            </OutputPanel>
          </motion.main>
        )}

        {/* ═══════════════════════ AGENT 4 ═══════════════════════ */}
        {activeStage === 'agent4' && (
          <motion.main
            key="agent4"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="fixed inset-0 pt-16 z-50 bg-[#F9F8F4] flex flex-col"
          >
            {/* Header matching OLD_PROJECT */}
            <div className="flex-shrink-0 bg-[#0d1117] border-b border-[#30363d] px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#8b949e]">Phase 04 — Human Review</div>
                <h2 className="font-serif text-xl text-[#c9d1d9]">
                  Patch <span className="italic font-normal text-[#8b949e]">Synthesizer</span>
                </h2>
              </div>
              <button
                onClick={() => setActiveStage('agent3')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#c9d1d9] rounded-md border border-[#30363d] hover:border-[#484f58] transition-colors"
              >
                ← Back to Agent 3
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <PatchReviewView 
                patches={a4Patches} 
                summary={a4Summary} 
                onDecisionMade={(file, decision, newSummary) => {
                  setA4Summary(newSummary);
                }}
              />
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(config) => {
          setApiKey(config.apiKey);
          setModelName(config.modelName);
          setActiveProvider(config.provider);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}


// ── Reusable Components ────────────────────────────────────────────

function StatusPill({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-stone-200 text-stone-500',
    running: 'bg-amber-100 text-amber-700 animate-pulse',
    reviewing: 'bg-blue-100 text-blue-700 animate-pulse',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status] || colors.idle}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'running' ? 'bg-amber-500 animate-pulse' :
        status === 'completed' ? 'bg-green-500' :
        status === 'error' ? 'bg-red-500' : 'bg-stone-400'
      }`}></span>
      {label}
    </div>
  );
}

function ModelSelector({ modelName, setModelName, disabled, onOpenSettings }: { modelName: string; setModelName: (v: string) => void; disabled: boolean; onOpenSettings: () => void }) {
  return (
    <div className="space-y-2.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Intelligence Core</label>
      <div className="relative group">
        <Code2 className="absolute left-3 top-3.5 text-stone-400 group-hover:text-nobel-gold transition-colors" size={16} />
        <input
          type="text"
          value={modelName}
          readOnly
          className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-lg cursor-default text-stone-600 font-mono text-xs truncate shadow-sm transition-all"
          placeholder="Select provider in Settings"
          title={modelName}
        />
      </div>
      <button 
        onClick={onOpenSettings} 
        className="text-[9px] text-stone-400 font-bold uppercase tracking-widest hover:text-nobel-gold transition-colors flex items-center gap-1.5"
      >
        Change provider in Settings <ArrowRight size={10} />
      </button>
    </div>
  );
}

interface TabDef { id: string; label: string; icon: React.ReactNode; }

function OutputPanel({ tabs, activeTab, onTabChange, children }: { tabs: TabDef[]; activeTab: string; onTabChange: (id: string) => void; children: React.ReactNode }) {
  return (
    <div className="lg:col-span-8 bg-white rounded-xl shadow-md border border-stone-200 overflow-hidden flex flex-col h-[75vh]">
      <div className="flex border-b border-stone-200 bg-[#F5F4F0]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id ? 'bg-white text-stone-900 border-t-2 border-t-nobel-gold' : 'text-stone-500 hover:text-stone-700 hover:bg-white/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function countFiles(tree: any): number {
  if (!tree) return 0;
  let count = (tree.files || []).length;
  for (const folder of Object.values(tree.folders || {})) {
    count += countFiles(folder);
  }
  return count;
}