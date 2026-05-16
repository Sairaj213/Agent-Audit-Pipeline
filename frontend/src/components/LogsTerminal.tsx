import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function LogsTerminal({ logs, status }: { logs: string[], status: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getColor = (log: string) => {
    if (log.includes('[+]') || log.includes('[SUCCESS]')) return 'text-green-400';
    if (log.includes('[-]') || log.includes('[SCAN]')) return 'text-stone-400';
    if (log.includes('[ERROR]') || log.includes('[FATAL]')) return 'text-red-400';
    if (log.includes('🚀') || log.includes('🎉')) return 'text-nobel-gold font-bold';
    return 'text-stone-300';
  }

  return (
    <div className="bg-[#1c1917] h-full flex flex-col font-mono text-xs md:text-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-900 border-b border-stone-800 text-stone-400">
        <Terminal size={16} className="text-nobel-gold"/> Live Audit Feed
        {status === 'running' && <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
      </div>
      <div className="p-4 overflow-y-auto flex-1 space-y-1">
        {logs.length === 0 ? (
            <div className="text-stone-600 italic">Awaiting ingestion sequence...</div>
        ) : (
            logs.map((log, i) => (
                <div key={i} className={`${getColor(log)} leading-relaxed break-all`}>{log}</div>
            ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}