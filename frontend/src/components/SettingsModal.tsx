import React, { useState, useEffect } from 'react';
import { Settings, X, Eye, EyeOff, Save, Plus, Trash2, Key, Activity, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:8000';

interface ApiConfig {
  provider: 'groq' | 'openai' | 'gemini' | 'claude' | 'lm-studio';
  apiKey: string;
  modelName: string;
  isActive: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig) => void;
}

const PROVIDER_CONFIG = {
  groq: {
    label: 'Groq',
    defaultModel: 'groq/llama-3.3-70b-versatile',
    keyLabel: 'API Key',
    url: 'https://console.groq.com/keys',
    docs: 'https://console.groq.com/docs/speedup'
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4-turbo',
    keyLabel: 'API Key',
    url: 'https://platform.openai.com/api-keys',
    docs: 'https://platform.openai.com/docs'
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-pro',
    keyLabel: 'API Key',
    url: 'https://aistudio.google.com/app/apikey',
    docs: 'https://ai.google.dev/tutorials/python_quickstart'
  },
  claude: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-opus-20240229',
    keyLabel: 'API Key',
    url: 'https://console.anthropic.com/account/keys',
    docs: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api'
  },
  'lm-studio': {
    label: 'LM Studio (Local)',
    defaultModel: 'local-model',
    keyLabel: 'Server URL',
    url: 'https://lmstudio.ai',
    docs: 'https://lmstudio.ai/docs'
  }
};

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<keyof typeof PROVIDER_CONFIG>('groq');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState(PROVIDER_CONFIG.groq.defaultModel);
  const [showKey, setShowKey] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<ApiConfig[]>([]);
  const [backendKeys, setBackendKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      loadBackendKeys();
    }
  }, [isOpen]);

  const loadConfigs = () => {
    const saved = localStorage.getItem('llm_configs');
    if (saved) {
      try {
        setSavedConfigs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load configs', e);
      }
    }
  };

  const loadBackendKeys = async () => {
    try {
      const res = await fetch(`${API}/api/settings/keys`);
      const data = await res.json();
      setBackendKeys(data.keys || []);
    } catch (e) {
      console.error('Failed to load backend keys', e);
    }
  };

  const syncBackendKeys = async (updatedConfigs: ApiConfig[]) => {
    // Save keys with provider prefix for backend disambiguation
    const formattedKeys = updatedConfigs.map(c => `${c.provider}|${c.apiKey}`);
    
    try {
      await fetch(`${API}/api/settings/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: formattedKeys })
      });
      loadBackendKeys();
    } catch (e) {
      console.error('Failed to sync backend keys', e);
    }
  };

  const handleAddConfig = () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    const newConfig: ApiConfig = {
      provider: selectedProvider,
      apiKey,
      modelName: modelName || PROVIDER_CONFIG[selectedProvider].defaultModel,
      isActive: savedConfigs.length === 0
    };

    const updated = savedConfigs.map(c => ({ ...c, isActive: false }));
    updated.push(newConfig);

    setSavedConfigs(updated);
    localStorage.setItem('llm_configs', JSON.stringify(updated));
    syncBackendKeys(updated);
    
    if (newConfig.isActive) onSave(newConfig);

    setApiKey('');
    setModelName(PROVIDER_CONFIG[selectedProvider].defaultModel);
  };

  const handleSetActive = (index: number) => {
    const updated = savedConfigs.map((c, i) => ({
      ...c,
      isActive: i === index
    }));
    setSavedConfigs(updated);
    localStorage.setItem('llm_configs', JSON.stringify(updated));
    onSave(updated[index]);
  };

  const handleDeleteConfig = (index: number) => {
    const updated = savedConfigs.filter((_, i) => i !== index);
    if (updated.length > 0) {
      if (!updated.find(c => c.isActive)) {
        updated[0].isActive = true;
      }
      setSavedConfigs(updated);
      localStorage.setItem('llm_configs', JSON.stringify(updated));
      const active = updated.find(c => c.isActive);
      if (active) onSave(active);
    } else {
      setSavedConfigs([]);
      localStorage.removeItem('llm_configs');
    }
    syncBackendKeys(updated);
  };

  const config = PROVIDER_CONFIG[selectedProvider];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[1000]"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-[#F9F8F4] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-stone-200"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-stone-200 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-nobel-gold rounded-full flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h2 className="font-serif text-2xl font-bold text-stone-900">Intelligence Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-stone-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-stone-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8">
              
              {/* Saved Configurations */}
              {savedConfigs.length > 0 && (
                <div className="bg-stone-50/50 rounded-xl p-6 border border-stone-200 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Active Configurations</h3>
                  <div className="space-y-2">
                    {savedConfigs.map((cfg, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                          cfg.isActive
                            ? 'bg-white border-2 border-nobel-gold shadow-sm'
                            : 'bg-white border border-stone-200 hover:border-stone-300'
                        }`}
                        onClick={() => handleSetActive(idx)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {cfg.isActive && <div className="w-2 h-2 bg-nobel-gold rounded-full" />}
                          <div>
                            <p className="text-stone-900 font-bold text-sm">
                              {PROVIDER_CONFIG[cfg.provider].label}
                            </p>
                            <p className="text-stone-500 text-xs font-mono">{cfg.modelName}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfig(idx);
                          }}
                          className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Configuration */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                  <Plus className="w-3 h-3" /> Add Provider
                </div>

                {/* Provider Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">
                    Select Provider
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {Object.entries(PROVIDER_CONFIG).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedProvider(key as keyof typeof PROVIDER_CONFIG);
                          setModelName(val.defaultModel);
                        }}
                        className={`p-3 rounded-lg text-[11px] font-semibold transition-all border ${
                          selectedProvider === key
                            ? 'bg-nobel-gold text-white border-nobel-gold shadow-md'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500">
                      {config.keyLabel}
                    </label>
                    <a href={config.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-nobel-gold font-bold hover:underline">Get Key →</a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Paste your ${config.label} ${config.keyLabel}`}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-nobel-gold transition-all"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3 text-stone-300 hover:text-stone-500">
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Model Name Input */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    Model Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={config.defaultModel}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:border-nobel-gold transition-all"
                  />
                  <p className="text-[10px] text-stone-400">Default: {config.defaultModel}</p>
                </div>

                <button
                  onClick={handleAddConfig}
                  className="w-full py-4 bg-nobel-gold text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-[#b8933f] transition-all shadow-lg shadow-nobel-gold/20 flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  Save Configuration
                </button>
              </div>

              {/* Documentation & Privacy */}
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <a href={config.docs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] text-nobel-gold font-bold uppercase tracking-widest hover:underline">
                  <BookOpen size={14} /> View Documentation
                </a>
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    <strong className="text-stone-900 uppercase tracking-tighter">🔒 Privacy:</strong> API keys are stored locally in your browser and your local filesystem (`api_keys.txt`). They are never transmitted to our servers.
                  </p>
                </div>
              </div>

              {/* Backend Status Bar */}
              <div className="flex items-center justify-between p-3 bg-stone-900 rounded-lg text-white">
                <div className="flex items-center gap-3">
                  <Activity size={14} className="text-green-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Backend Sync Active</span>
                </div>
                <div className="text-[10px] text-stone-400 font-mono">
                  {backendKeys.length} KEYS IN ROTATION
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
