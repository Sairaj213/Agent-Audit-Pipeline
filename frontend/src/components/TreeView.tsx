import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileCode2, Settings, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getIcon = (name: string, isFolder: boolean) => {
  if (isFolder) return <Folder size={18} className="text-nobel-gold fill-nobel-gold/20" />;
  if (name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.tsx') || name.endsWith('.js')) return <FileCode2 size={16} className="text-stone-500" />;
  if (name.endsWith('.json') || name.endsWith('.env') || name.endsWith('.yml')) return <Settings size={16} className="text-stone-500" />;
  return <FileText size={16} className="text-stone-400" />;
}

const TreeNode = ({ name, data, isFolder }: { name: string, data?: any, isFolder: boolean }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="font-sans text-sm">
      <div 
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${isFolder ? 'cursor-pointer hover:bg-stone-100/80 font-medium text-stone-800' : 'text-stone-600'}`}
        onClick={() => isFolder && setIsOpen(!isOpen)}
      >
        {isFolder ? (
            <span className="text-stone-400 w-4">{isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
        ) : <span className="w-4" />}
        {getIcon(name, isFolder)}
        <span>{name}</span>
      </div>
      
      <AnimatePresence>
        {isFolder && isOpen && data && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="pl-6 overflow-hidden border-l border-stone-200 ml-4 my-1"
          >
            {data.folders && Object.entries(data.folders).map(([folderName, folderData]) => (
                <TreeNode key={folderName} name={folderName} data={folderData} isFolder={true} />
            ))}
            {data.files && data.files.map((fileName: string) => (
                <TreeNode key={fileName} name={fileName} isFolder={false} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function TreeView({ treeData }: { treeData: any }) {
  if (!treeData || Object.keys(treeData).length === 0) {
    return <div className="h-full flex items-center justify-center text-stone-400 italic">No architecture map generated yet.</div>;
  }
  return (
    <div className="p-6 bg-[#F9F8F4]/50 h-full overflow-y-auto">
        <div className="mb-4 inline-block px-3 py-1 border border-nobel-gold text-nobel-gold text-xs tracking-[0.2em] uppercase font-bold rounded-full bg-white">Final Blueprint</div>
        <TreeNode name="Root Repository" data={treeData} isFolder={true} />
    </div>
  );
}