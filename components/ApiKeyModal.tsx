import React, { useState, useEffect } from 'react';
import { Key, ExternalLink, Check, X, Zap, Star, Sparkles } from 'lucide-react';

const AVAILABLE_MODELS = [
  { 
    id: 'gemini-3-flash-preview', 
    name: 'Gemini 3 Flash', 
    description: 'Nhanh nhất, phù hợp mọi tác vụ',
    badge: 'Mặc định',
    color: 'blue'
  },
  { 
    id: 'gemini-3-pro-preview', 
    name: 'Gemini 3 Pro', 
    description: 'Mạnh mẽ hơn, chất lượng cao',
    badge: 'Pro',
    color: 'purple'
  },
  { 
    id: 'gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    description: 'Ổn định, tiết kiệm quota',
    badge: 'Dự phòng',
    color: 'green'
  }
];

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, model: string) => void;
  initialApiKey?: string;
  initialModel?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialApiKey = '', 
  initialModel = 'gemini-3-flash-preview' 
}) => {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setApiKey(initialApiKey);
    setSelectedModel(initialModel);
  }, [initialApiKey, initialModel, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave(apiKey.trim(), selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim()) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-2xl">
              <Key className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Thiết lập API Key</h2>
              <p className="text-sm text-slate-400 font-medium">Cấu hình để sử dụng SpeakPro</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* API Key Input */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              🔑 API Key của bạn
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="AIzaSy..."
                className="w-full px-5 py-4 pr-24 rounded-2xl border-2 border-slate-100 focus:border-blue-400 outline-none text-lg font-medium transition-all bg-slate-50 focus:bg-white"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors"
              >
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            <a 
              href="https://aistudio.google.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ExternalLink size={14} />
              Lấy API Key miễn phí tại Google AI Studio
            </a>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              🤖 Chọn Model AI
            </label>
            <div className="grid gap-3">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedModel === model.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${
                    model.color === 'blue' ? 'bg-blue-100' :
                    model.color === 'purple' ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    {model.color === 'blue' ? <Zap className="text-blue-600" size={20} /> :
                     model.color === 'purple' ? <Star className="text-purple-600" size={20} /> :
                     <Sparkles className="text-green-600" size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{model.name}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        model.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        model.color === 'purple' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{model.description}</p>
                  </div>
                  {selectedModel === model.id && (
                    <Check className="text-blue-600" size={20} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-8 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100"
          >
            Lưu & Bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
