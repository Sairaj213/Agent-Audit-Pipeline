import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, PenLine, ChevronDown, ChevronRight, FileCode2, Undo2 } from 'lucide-react';

interface AuditFileResult {
  file_path: string;
  status: 'clean' | 'edited' | 'rejected' | 'skipped' | 'error';
  issues: string[];
  edited: boolean;
  rationale: string;
  breaking_changes: string[];
}

interface ApprovalItem {
  file_path: string;
  rationale: string;
  issues_fixed: string[];
}

interface AuditSummary {
  total_files: number;
  files_edited: number;
  files_clean: number;
  files_with_issues: number;
  edits_rejected: number;
}

interface AuditData {
  audit_results: AuditFileResult[];
  approval_queue: ApprovalItem[];
  summary: AuditSummary;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  clean: {
    icon: <ShieldCheck size={16} />,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    label: 'Clean'
  },
  edited: {
    icon: <PenLine size={16} />,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    label: 'Edited'
  },
  rejected: {
    icon: <Undo2 size={16} />,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    label: 'Rollback'
  },
  skipped: {
    icon: <ShieldX size={16} />,
    color: 'text-stone-400',
    bg: 'bg-stone-50 border-stone-200',
    label: 'Skipped'
  },
  error: {
    icon: <ShieldAlert size={16} />,
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    label: 'Error'
  },
};

function AuditFileCard({ result, index }: { result: AuditFileResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[result.status] || statusConfig.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <div
        className={`border rounded-lg overflow-hidden transition-all ${config.bg} ${expanded ? 'shadow-sm' : ''}`}
      >
        {/* Header row */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/40 transition-colors"
        >
          {/* Status Icon */}
          <div className={`flex-shrink-0 ${config.color}`}>
            {config.icon}
          </div>

          {/* File path */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <FileCode2 size={13} className="text-stone-400 flex-shrink-0" />
            <span className="text-sm font-medium text-stone-800 truncate">{result.file_path}</span>
          </div>

          {/* Status badge */}
          <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${config.color} bg-white/60`}>
            {config.label}
          </span>

          {/* Issues count */}
          {result.issues.length > 0 && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full text-amber-700 bg-amber-100">
              <AlertTriangle size={9} />
              {result.issues.length}
            </span>
          )}

          {/* Expand indicator */}
          <span className="text-stone-400 flex-shrink-0">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/50">
                {/* Issues */}
                {result.issues.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Issues Found
                    </div>
                    <div className="space-y-1">
                      {result.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-stone-700">
                          <AlertTriangle size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit rationale */}
                {result.rationale && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                      Edit Rationale
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{result.rationale}</p>
                  </div>
                )}

                {/* Breaking changes */}
                {result.breaking_changes.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1.5">
                      Breaking Changes Broadcasted
                    </div>
                    <div className="space-y-1">
                      {result.breaking_changes.map((bc, i) => (
                        <span key={i} className="inline-block mr-2 px-2 py-0.5 text-[11px] font-mono text-red-600 bg-red-100 rounded border border-red-200">
                          {bc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function AuditResultsView({ auditData }: { auditData: AuditData | null }) {
  const [activeSection, setActiveSection] = useState<'results' | 'queue'>('results');

  if (!auditData) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400 italic">
        No audit results generated yet.
      </div>
    );
  }

  const { audit_results, approval_queue, summary } = auditData;

  return (
    <div className="h-full flex flex-col bg-[#F9F8F4]/50">
      {/* Summary Bar */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-stone-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block px-3 py-1 border border-nobel-gold text-nobel-gold text-xs tracking-[0.2em] uppercase font-bold rounded-full bg-white">
            Audit Report
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard label="Total" value={summary.total_files} icon={<Shield size={14} />} color="text-stone-600" />
          <SummaryCard label="Clean" value={summary.files_clean} icon={<CheckCircle2 size={14} />} color="text-green-600" />
          <SummaryCard label="Issues" value={summary.files_with_issues} icon={<AlertTriangle size={14} />} color="text-amber-600" />
          <SummaryCard label="Edited" value={summary.files_edited} icon={<PenLine size={14} />} color="text-blue-600" />
          <SummaryCard label="Rejected" value={summary.edits_rejected} icon={<Undo2 size={14} />} color="text-red-600" />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex-shrink-0 flex border-b border-stone-200 bg-[#F5F4F0]">
        <button
          onClick={() => setActiveSection('results')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeSection === 'results' ? 'bg-white text-stone-900 border-b-2 border-b-nobel-gold' : 'text-stone-500 hover:text-stone-700'}`}
        >
          File Results ({audit_results.length})
        </button>
        <button
          onClick={() => setActiveSection('queue')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${activeSection === 'queue' ? 'bg-white text-stone-900 border-b-2 border-b-nobel-gold' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Approval Queue ({approval_queue.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'results' ? (
          <div className="space-y-2">
            {audit_results.map((result, i) => (
              <AuditFileCard key={result.file_path} result={result} index={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {approval_queue.length === 0 ? (
              <div className="text-center text-stone-400 italic py-8">No edits pending review.</div>
            ) : (
              approval_queue.map((item, i) => (
                <motion.div
                  key={item.file_path}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 bg-white rounded-lg border border-stone-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <PenLine size={14} className="text-blue-600" />
                    <span className="font-medium text-sm text-stone-800">{item.file_path}</span>
                  </div>
                  <p className="text-xs text-stone-600 mb-2 leading-relaxed">{item.rationale}</p>
                  {item.issues_fixed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.issues_fixed.map((issue, j) => (
                        <span key={j} className="inline-block px-2 py-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded">
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-[#F9F8F4] rounded-lg border border-stone-200">
      <span className={color}>{icon}</span>
      <div>
        <div className="text-lg font-bold text-stone-800 leading-none">{value}</div>
        <div className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">{label}</div>
      </div>
    </div>
  );
}
