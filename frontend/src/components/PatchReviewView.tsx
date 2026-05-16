import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  FileCode2, AlertTriangle, Plus, Minus, Clock,
  ThumbsUp, ThumbsDown, ArrowRight, Layers
} from 'lucide-react';

interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'remove' | 'context';
  content: string;
}

interface PatchStats {
  additions: number;
  deletions: number;
}

interface PatchData {
  index: number;
  file_path: string;
  rationale: string;
  issues_fixed: string[];
  status: string;
  diff_lines: DiffLine[];
  stats: PatchStats;
}

interface PatchSummary {
  total_patches: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  approved_files: string[];
  rejected_files: string[];
  pending_files: string[];
  is_complete: boolean;
}

const API = 'http://localhost:8000';

export default function PatchReviewView({
  patches,
  summary,
  onDecisionMade,
  onFixRequest,
}: {
  patches: PatchData[];
  summary: PatchSummary | null;
  onDecisionMade: (filePath: string, decision: string, newSummary: PatchSummary) => void;
  onFixRequest: (fixRequest: any) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'review' | 'summary'>('review');
  const healthCheckRun = React.useRef(false);

  const allDecided = summary?.is_complete ||
    (patches && patches.length > 0 && patches.filter(p => p.status === 'pending').every(p => decisions[p.file_path]));

  React.useEffect(() => {
    if (allDecided && !isSubmitting && !healthCheckRun.current) {
      healthCheckRun.current = true;
      setViewMode('summary');
    }
  }, [allDecided, isSubmitting]);

  if (!patches || patches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-400" />
        </div>
        <p className="italic text-lg">No patches require review.</p>
        <p className="text-sm">Agent 3 found no issues requiring code changes.</p>
      </div>
    );
  }

  const pendingPatches = patches.filter(p => p.status === 'pending' && !decisions[p.file_path]);
  const currentPatch = patches[currentIdx];
  const patchDecision = currentPatch ? decisions[currentPatch.file_path] : null;

  const handleDecision = async (decision: string) => {
    if (!currentPatch || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API}/api/agent4/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: currentPatch.file_path, decision })
      });
      const data = await res.json();

      setDecisions(prev => ({ ...prev, [currentPatch.file_path]: decision }));
      onDecisionMade(currentPatch.file_path, decision, data.summary);

      const nextUndecided = patches.findIndex(
        (p, i) => i > currentIdx && p.status === 'pending' && !decisions[p.file_path] && p.file_path !== currentPatch.file_path
      );
      if (nextUndecided !== -1) {
        setTimeout(() => setCurrentIdx(nextUndecided), 400);
      }
    } catch (e) {
      console.error('Decision failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statsTotal = summary || {
    total_patches: patches.length,
    approved_count: Object.values(decisions).filter(d => d === 'approve').length,
    rejected_count: Object.values(decisions).filter(d => d === 'reject').length,
    pending_count: pendingPatches.length,
    approved_files: [],
    rejected_files: [],
    pending_files: [],
    is_complete: false,
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      <div className="flex-shrink-0 bg-[#161b22] border-b border-[#30363d] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b949e]">Patch Review</span>
            <span className="text-xs text-[#8b949e]">{currentIdx + 1} of {patches.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'review' ? 'summary' : 'review')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:text-[#c9d1d9] hover:border-[#484f58] transition-colors"
            >
              <Layers size={12} />
              {viewMode === 'review' ? 'Summary' : 'Review'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatBadge icon={<CheckCircle2 size={11} />} value={statsTotal.approved_count} label="Approved" color="text-[#3fb950] bg-[#12261e]" />
          <StatBadge icon={<XCircle size={11} />} value={statsTotal.rejected_count} label="Rejected" color="text-[#f85149] bg-[#2a1215]" />
          <StatBadge icon={<Clock size={11} />} value={statsTotal.pending_count} label="Pending" color="text-[#d29922] bg-[#2a2111]" />
          <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden ml-2">
            <div className="h-full flex">
              <div className="h-full bg-[#3fb950] transition-all duration-500" style={{ width: `${(statsTotal.approved_count / patches.length) * 100}%` }} />
              <div className="h-full bg-[#f85149] transition-all duration-500" style={{ width: `${(statsTotal.rejected_count / patches.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 bg-[#0d1117] border-b border-[#30363d] overflow-x-auto">
        <div className="flex">
          {patches.map((p, i) => {
            const dec = decisions[p.file_path];
            const isActive = i === currentIdx;
            return (
              <button
                key={p.file_path}
                onClick={() => { setCurrentIdx(i); setViewMode('review'); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-r border-[#30363d] whitespace-nowrap transition-colors ${
                  isActive ? 'bg-[#161b22] text-[#c9d1d9] border-b-2 border-b-[#c9a54e]' : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  dec === 'approve' ? 'bg-[#3fb950]' : dec === 'reject' ? 'bg-[#f85149]' : p.status === 'skipped' ? 'bg-[#484f58]' : 'bg-[#d29922]'
                }`} />
                {p.file_path.split('/').pop()}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'review' && currentPatch ? (
          <motion.div
            key={`review-${currentIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-shrink-0 bg-[#161b22] border-b border-[#30363d] px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCode2 size={16} className="text-[#8b949e]" />
                  <span className="font-mono text-sm text-[#c9d1d9]">{currentPatch.file_path}</span>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="flex items-center gap-1 text-xs text-[#3fb950] font-mono"><Plus size={11} />+{currentPatch.stats.additions}</span>
                    <span className="flex items-center gap-1 text-xs text-[#f85149] font-mono"><Minus size={11} />-{currentPatch.stats.deletions}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0} className="p-1.5 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentIdx(Math.min(patches.length - 1, currentIdx + 1))} disabled={currentIdx === patches.length - 1} className="p-1.5 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
                </div>
              </div>
              {(currentPatch.issues_fixed.length > 0 || currentPatch.rationale) && (
                <div className="mt-3 flex flex-col gap-2">
                  {currentPatch.issues_fixed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentPatch.issues_fixed.map((issue, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#2a2111] text-[#d29922] border border-[#3d2e0a]"><AlertTriangle size={9} /> {issue}</span>
                      ))}
                    </div>
                  )}
                  {currentPatch.rationale && <p className="text-xs text-[#8b949e] leading-relaxed italic">{currentPatch.rationale}</p>}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-[1.6]">
              {currentPatch.status === 'skipped' ? (
                <div className="h-full flex items-center justify-center text-[#484f58] italic">Skipped — missing file or backup</div>
              ) : currentPatch.diff_lines.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#484f58] italic">No changes detected</div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {currentPatch.diff_lines.map((line, i) => {
                      let bg = line.type === 'header' ? 'bg-[#161b22]' : line.type === 'hunk' ? 'bg-[#1c2541]' : line.type === 'add' ? 'bg-[#12261e]' : line.type === 'remove' ? 'bg-[#2a1215]' : '';
                      let textColor = line.type === 'header' ? 'text-[#8b949e] font-bold' : line.type === 'hunk' ? 'text-[#79c0ff]' : line.type === 'add' ? 'text-[#aff5b4]' : line.type === 'remove' ? 'text-[#ffa198]' : 'text-[#c9d1d9]';
                      return (
                        <tr key={i} className={`${bg} hover:brightness-110 transition-all`}>
                          <td className="w-10 text-right pr-3 pl-3 text-[11px] text-[#484f58] select-none border-r border-[#30363d]">{line.type !== 'header' && line.type !== 'hunk' ? i : ''}</td>
                          <td className={`px-4 py-0 whitespace-pre-wrap break-all ${textColor}`}>{line.content}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex-shrink-0 bg-[#161b22] border-t border-[#30363d] px-5 py-3">
              {patchDecision ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm uppercase tracking-wider ${patchDecision === 'approve' ? 'bg-[#12261e] text-[#3fb950] border border-[#238636]' : 'bg-[#2a1215] text-[#f85149] border border-[#da3633]'}`}>
                  {patchDecision === 'approve' ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                  {patchDecision === 'approve' ? 'Patch Approved' : 'Patch Rejected — Rolled Back'}
                </motion.div>
              ) : currentPatch.status === 'skipped' ? (
                <div className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm text-[#484f58] bg-[#0d1117] border border-[#30363d] italic">No action required for skipped patches</div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => handleDecision('approve')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-50 transition-colors shadow-lg shadow-[#238636]/20">
                    <CheckCircle2 size={16} /> {isSubmitting ? 'Applying...' : 'Approve Patch'}
                  </button>
                  <button onClick={() => handleDecision('reject')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[#21262d] text-[#f85149] border border-[#da3633] hover:bg-[#2a1215] disabled:opacity-50 transition-colors">
                    <XCircle size={16} /> {isSubmitting ? 'Reverting...' : 'Reject & Rollback'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {allDecided && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 p-4 rounded-lg bg-[#161b22] border border-[#30363d]">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-[#3fb950]" />
                    <div>
                      <div className="text-sm font-bold text-[#c9d1d9]">Review Complete</div>
                      <div className="text-xs text-[#8b949e]">All patches have been reviewed.</div>
                    </div>
                  </div>
                  <div className="border-t border-[#30363d] pt-4 mt-2">
                    <div className="flex flex-col mb-3 gap-2">
                      <div className="text-sm font-bold text-[#c9d1d9]">Project Health Check</div>
                      <p className="text-xs text-[#8b949e]">Execute your project in a deterministic sandbox. If it crashes, Agent 4 will generate a targeted fix request for Agent 3.</p>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="text" id="verifyCmd" placeholder="Explicit command (e.g., python run.py)" className="flex-1 bg-[#0d1117] text-[#c9d1d9] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#58a6ff]" />
                        <button 
                          className="px-4 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          disabled={isSubmitting}
                          onClick={async (e) => {
                            const btn = e.currentTarget;
                            try {
                              setIsSubmitting(true);
                              btn.innerText = 'Verifying...';
                              const cmd = (document.getElementById('verifyCmd') as HTMLInputElement).value;
                              const res = await fetch(`${API}/api/agent4/health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verify_cmd: cmd }) });
                              const data = await res.json();
                              if (!data.healthy && data.fix_request) onFixRequest(data.fix_request);
                              else if (data.healthy) alert('✅ Project Runs Successfully!');
                              else alert('❌ Health Check Failed');
                            } finally {
                              setIsSubmitting(false);
                              btn.innerText = 'Run Verification';
                            }
                          }}
                        >Run Verification</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8b949e] mb-3">Decision Ledger</h3>
                {patches.map((p, i) => {
                  const dec = decisions[p.file_path];
                  return (
                    <motion.div key={p.file_path} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:brightness-110 ${dec === 'approve' ? 'bg-[#12261e] border-[#238636]/40' : dec === 'reject' ? 'bg-[#2a1215] border-[#da3633]/40' : p.status === 'skipped' ? 'bg-[#161b22] border-[#30363d]' : 'bg-[#1c1f24] border-[#30363d]'}`} onClick={() => { setCurrentIdx(i); setViewMode('review'); }}>
                      {dec === 'approve' ? <CheckCircle2 size={14} className="text-[#3fb950]" /> : dec === 'reject' ? <XCircle size={14} className="text-[#f85149]" /> : p.status === 'skipped' ? <Minus size={14} className="text-[#484f58]" /> : <Clock size={14} className="text-[#d29922]" />}
                      <span className="flex-1 font-mono text-xs text-[#c9d1d9] truncate">{p.file_path}</span>
                      <span className="flex items-center gap-2 text-[10px] font-mono"><span className="text-[#3fb950]">+{p.stats.additions}</span><span className="text-[#f85149]">-{p.stats.deletions}</span></span>
                      <ArrowRight size={12} className="text-[#484f58]" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBadge({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold ${color}`}>{icon} <span>{value}</span> <span className="text-[#484f58] font-normal">{label}</span></div>;
}
