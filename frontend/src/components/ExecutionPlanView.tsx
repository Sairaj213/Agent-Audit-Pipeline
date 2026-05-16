import React from 'react';
import { motion } from 'framer-motion';
import { FileCode2, ArrowDown, CircleDot, CheckCircle2 } from 'lucide-react';

interface ExecutionNode {
  file_path: string;
  dependencies: string[];
}

interface ExecutionPlanData {
  execution_sequence: ExecutionNode[];
}

export default function ExecutionPlanView({ planData }: { planData: ExecutionPlanData | null }) {
  if (!planData || !planData.execution_sequence || planData.execution_sequence.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400 italic">
        No execution plan generated yet.
      </div>
    );
  }

  const sequence = planData.execution_sequence;

  return (
    <div className="p-6 bg-[#F9F8F4]/50 h-full overflow-y-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-block px-3 py-1 border border-nobel-gold text-nobel-gold text-xs tracking-[0.2em] uppercase font-bold rounded-full bg-white">
          Execution Sequence
        </div>
        <span className="text-xs text-stone-400 font-sans">
          {sequence.length} files ordered
        </span>
      </div>

      <div className="space-y-1">
        {sequence.map((node, index) => (
          <React.Fragment key={node.file_path}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              className="group"
            >
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-stone-200/80 hover:border-nobel-gold/40 hover:shadow-sm transition-all">
                {/* Step Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold font-sans">
                  {index + 1}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={14} className="text-nobel-gold flex-shrink-0" />
                    <span className="font-sans text-sm font-medium text-stone-800 truncate">
                      {node.file_path}
                    </span>
                  </div>

                  {/* Dependencies */}
                  {node.dependencies && node.dependencies.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mr-1 self-center">
                        depends on:
                      </span>
                      {node.dependencies.map((dep) => (
                        <span
                          key={dep}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 text-[11px] rounded-md font-mono border border-stone-200/60"
                        >
                          <CircleDot size={8} className="text-stone-400" />
                          {dep}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-green-600">
                      <CheckCircle2 size={10} />
                      <span>No dependencies — foundational file</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Connector Arrow */}
            {index < sequence.length - 1 && (
              <div className="flex justify-start pl-6 py-0.5">
                <ArrowDown size={14} className="text-stone-300" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Summary Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: sequence.length * 0.04 + 0.3 }}
        className="mt-6 p-4 bg-stone-900 rounded-lg text-center"
      >
        <span className="text-nobel-gold font-serif text-sm">
          ✦ Execution plan complete — {sequence.length} files sequenced
        </span>
      </motion.div>
    </div>
  );
}
