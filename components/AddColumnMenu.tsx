import React, { useState } from 'react';
import { ColumnType, ColumnTemplate } from '../types';
import { generatePromptHelper } from '../services/openRouterService';
import { addTemplateToLibrary } from '../utils/fileStorage';
import { 
  X, 
  HelpCircle, 
  ChevronDown, 
  Check, 
  Sparkles, 
  Loader2,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Trash2,
  Library,
  Save
} from './Icons';

const COLUMN_TYPES: { type: ColumnType; label: string; icon: React.FC<any> }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'boolean', label: 'Yes/No', icon: CheckSquare },
  { type: 'list', label: 'List', icon: List },
];

interface AddColumnMenuProps {
  triggerRect: DOMRect;
  onClose: () => void;
  onSave: (col: { name: string; type: ColumnType; prompt: string }) => void;
  onDelete?: () => void;
  modelId: string;
  initialData?: { name: string; type: ColumnType; prompt: string };
  onOpenLibrary?: () => void;
}

export const AddColumnMenu: React.FC<AddColumnMenuProps> = ({
  triggerRect,
  onClose,
  onSave,
  onDelete,
  modelId,
  initialData,
  onOpenLibrary
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<ColumnType>(initialData?.type || 'text');
  const [prompt, setPrompt] = useState(initialData?.prompt || '');
  const [category, setCategory] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState('');

  const selectedType = COLUMN_TYPES.find(t => t.type === type) || COLUMN_TYPES[0];

  // Calculate position
  // Default: Align the RIGHT edge of the menu with the RIGHT edge of the trigger (extends left)
  // This prevents it from going off-screen for columns on the right side.
  const MENU_WIDTH = 400;
  let top = triggerRect.bottom + 8;
  let left = triggerRect.right - MENU_WIDTH;

  // If that pushes it off-screen to the left (e.g. very first column on narrow screens), 
  // force it to the left edge plus a margin.
  if (left < 10) {
    left = 10;
  }

  const handleAiGeneratePrompt = async () => {
    if (!name) return;
    
    setIsGeneratingPrompt(true);
    setPromptError('');
    try {
      const suggestion = await generatePromptHelper(name, type, prompt || undefined, modelId);
      setPrompt(suggestion);
    } catch (e) {
      console.error("Failed to generate prompt", e);
      setPromptError(e instanceof Error ? e.message : 'Unable to generate a prompt.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSave = () => {
    if (name && prompt) {
      // Save to library if checkbox is checked
      if (saveToLibrary) {
        addTemplateToLibrary({
          name,
          type,
          prompt,
          category: category || undefined
        });
      }
      onSave({ name, type, prompt });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div 
        className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 w-[400px]"
        style={{ top, left }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-colors z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="p-5 space-y-5">
            {/* Label Input */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <label className="text-xs font-semibold">Label</label>
                </div>
                <input 
                    type="text" 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. Persons mentioned"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSave()}
                />
            </div>

            {/* Format Dropdown */}
            <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-slate-500 ml-1">Format</label>
                <button 
                  onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
                  className="w-full flex items-center justify-between border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <div className="flex items-center gap-2">
                    <selectedType.icon className="w-4 h-4 text-slate-500" />
                    <span>{selectedType.label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                
                {isTypeMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsTypeMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 shadow-xl rounded-lg overflow-hidden z-30 py-1 max-h-[200px] overflow-y-auto">
                      {COLUMN_TYPES.map((t) => (
                        <button
                          key={t.type}
                          onClick={() => { setType(t.type); setIsTypeMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 text-left"
                        >
                          <t.icon className="w-4 h-4 text-slate-400" />
                          <span>{t.label}</span>
                          {type === t.type && <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-1.5">
                 <div className="flex items-center gap-1.5 text-slate-500">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <label className="text-xs font-semibold">Prompt</label>
                </div>
                <div className="relative">
                    <textarea 
                        className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none min-h-[100px] resize-none transition-all"
                        placeholder="Describe what data to extract..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    {/* AI Generate / Optimize Button */}
                    <button 
                      onClick={handleAiGeneratePrompt}
                      disabled={isGeneratingPrompt || !name}
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isGeneratingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {prompt ? "Optimize" : "AI Generate"}
                    </button>
                </div>
            </div>

            {/* Save to Library Option */}
            {promptError && <p role="alert" className="text-xs text-red-600">{promptError}</p>}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800">
                  Save to Column Library
                </span>
              </label>
              
              {saveToLibrary && (
                <input
                  type="text"
                  placeholder="Category (optional, e.g. Legal, Financial)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                />
              )}
            </div>
        </div>

        <div className={`px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between gap-3`}>
             <div className="flex items-center gap-2">
               {initialData && onDelete && (
                 <button
                   onClick={onDelete}
                   className="flex items-center gap-2 px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium text-xs transition-colors"
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                   Delete
                 </button>
               )}
               {onOpenLibrary && !initialData && (
                 <button
                   onClick={onOpenLibrary}
                   className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg font-medium text-xs transition-colors"
                 >
                   <Library className="w-3.5 h-3.5" />
                   Browse Library
                 </button>
               )}
             </div>
             <button 
                onClick={handleSave}
                disabled={!name || !prompt}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-xs shadow-lg shadow-slate-900/10 transition-all active:scale-95"
            >
               {initialData ? 'Update Column' : 'Create Column'}
            </button>
        </div>
      </div>
    </>
  );
};
