import React, { useState, useRef } from 'react';
import { DataGrid } from './components/DataGrid';
import { VerificationSidebar } from './components/VerificationSidebar';
import { ChatInterface } from './components/ChatInterface';
import { AddColumnMenu } from './components/AddColumnMenu';
import { ColumnLibrary } from './components/ColumnLibrary';
import { extractColumnData, DEFAULT_MODEL, normalizeModelId } from './services/openRouterService';
import { processDocumentToMarkdown } from './services/documentProcessor';
import { DocumentFile, Column, ExtractionResult, SidebarMode, ColumnType, SavedProject, ColumnTemplate } from './types';
import { MessageSquare, Table, Square, FilePlus, LayoutTemplate, ChevronDown, Zap, Cpu, Brain, Trash2, Play, Download, WrapText, Loader2, Save, FolderOpen, RefreshCw } from './components/Icons';
import { SAMPLE_COLUMNS } from './utils/sampleData';
import { saveProject, loadProject } from './utils/fileStorage';

// Available Models
const MODELS = [
  { id: DEFAULT_MODEL, name: 'OpenRouter Free', description: 'OpenRouter · Free models', icon: Zap },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'OpenRouter · Fast', icon: Zap },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', description: 'OpenRouter · General purpose', icon: Cpu },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'OpenRouter · Detailed analysis', icon: Brain },
];

const App: React.FC = () => {
  // State
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);

  // Start with empty columns for a clean slate
  const [columns, setColumns] = useState<Column[]>([]);
  const [results, setResults] = useState<ExtractionResult>({});
  
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('none');
  const [selectedCell, setSelectedCell] = useState<{ docId: string; colId: string } | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  
  // Verification Sidebar Expansion State
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  
  // Model State
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  // Add/Edit Column Menu State
  const [addColumnAnchor, setAddColumnAnchor] = useState<DOMRect | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  
  // Column Library State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Extraction Control
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Text Wrap State
  const [isTextWrapEnabled, setIsTextWrapEnabled] = useState(false);

  // Document Selection State (for re-run)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Handlers
  
  // Project Save/Load Handlers
  const handleSaveProject = async () => {
    const project: SavedProject = {
      version: 1,
      name: projectName,
      savedAt: new Date().toISOString(),
      columns: columns,
      documents: documents,
      results: results,
      selectedModel: selectedModel
    };
    
    try {
      const success = await saveProject(project);
      if (success) {
        // Brief visual feedback could be added here
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  const handleLoadProject = async () => {
    // Warn if there's unsaved work
    const hasWork = documents.length > 0 || columns.length > 0 || Object.keys(results).length > 0;
    if (hasWork && !window.confirm('Loading a project will replace your current work. Continue?')) {
      return;
    }
    
    try {
      const project = await loadProject();
      if (project) {
        setProjectName(project.name);
        setColumns(project.columns);
        setDocuments(project.documents);
        setResults(project.results);
        if (project.selectedModel) {
          setSelectedModel(normalizeModelId(project.selectedModel));
        }
        // Reset UI state
        setSidebarMode('none');
        setSelectedCell(null);
        setPreviewDocId(null);
        setSelectedDocIds(new Set());
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project. The file may be corrupted or invalid.');
    }
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const fileList: File[] = Array.from(event.target.files);
      processUploadedFiles(fileList);
      // Reset input
      event.target.value = '';
    }
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setIsConverting(true);
    try {
        const processedFiles: DocumentFile[] = [];

        for (const file of fileList) {
          // Use local deterministic processor (markitdown style)
          const markdownContent = await processDocumentToMarkdown(file);
          
          // Encode to Base64 to match our storage format (mimicking the sample data structure)
          // This keeps the rest of the app (which expects base64 strings for "content") happy
          const contentBase64 = btoa(unescape(encodeURIComponent(markdownContent)));

          processedFiles.push({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            content: contentBase64,
            mimeType: 'text/markdown' // Force to markdown so the viewer treats it as text
          });
        }

        setDocuments(prev => [...prev, ...processedFiles]);
    } catch (error) {
        console.error("Failed to process files:", error);
        alert("Error processing some files. Please check if they are valid PDF or DOCX documents.");
    } finally {
        setIsConverting(false);
    }
  };

  const handleLoadSample = () => {
    const sampleCols = SAMPLE_COLUMNS;

    // setDocuments([]); // Keep existing documents
    setColumns(sampleCols);
    setResults({}); // Reset results as columns have changed
    setSidebarMode('none');
    setProjectName('PE Side Letters Review');
    setPreviewDocId(null);
    setSelectedCell(null);
  };

  const handleClearAll = () => {
    // Only confirm if actual analysis work (results) exists.
    // If just documents are loaded, clear immediately for better UX.
    const hasWork = Object.keys(results).length > 0;
    
    if (hasWork && !window.confirm("Are you sure you want to clear the project? Analysis results will be lost.")) {
      return;
    }

    // Abort processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);

    // Reset State completely
    setDocuments([]);
    setColumns([]);
    setResults({});
    setSidebarMode('none');
    setSelectedCell(null);
    setPreviewDocId(null);
    setProjectName('Untitled Project');
    setAddColumnAnchor(null);
    setEditingColumnId(null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveDoc = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setResults(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    if (selectedCell?.docId === docId) {
      setSidebarMode('none');
      setSelectedCell(null);
    }
    if (previewDocId === docId) {
      setPreviewDocId(null);
      setSidebarMode('none');
    }
  };

  const handleSaveColumn = (colDef: { name: string; type: ColumnType; prompt: string }) => {
    if (editingColumnId) {
      // Update existing column
      setColumns(prev => prev.map(c => c.id === editingColumnId ? { ...c, ...colDef } : c));
      setEditingColumnId(null);
    } else {
      // Create new column
      const newCol: Column = {
        id: `col_${Date.now()}`,
        name: colDef.name,
        type: colDef.type,
        prompt: colDef.prompt,
        status: 'idle',
        width: 250 // Default width
      };
      setColumns(prev => [...prev, newCol]);
    }
    setAddColumnAnchor(null);
  };
  
  const handleDeleteColumn = () => {
    if (editingColumnId) {
        setColumns(prev => prev.filter(c => c.id !== editingColumnId));
        // Clean up results for this column
        setResults(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(docId => {
                if (next[docId] && next[docId][editingColumnId]) {
                    // We create a copy of the doc results to avoid mutation
                    const docResults = { ...next[docId] };
                    delete docResults[editingColumnId];
                    next[docId] = docResults;
                }
            });
            return next;
        });
        
        if (selectedCell?.colId === editingColumnId) {
            setSelectedCell(null);
            setSidebarMode('none');
        }
        
        setEditingColumnId(null);
        setAddColumnAnchor(null);
    }
  };

  const handleEditColumn = (colId: string, rect: DOMRect) => {
    setEditingColumnId(colId);
    setAddColumnAnchor(rect);
  };
  
  const handleColumnResize = (colId: string, newWidth: number) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
  };

  const handleCloseMenu = () => {
    setAddColumnAnchor(null);
    setEditingColumnId(null);
  };

  const handleSelectTemplate = (template: ColumnTemplate) => {
    // Create a new column from the template
    const newCol: Column = {
      id: `col_${Date.now()}`,
      name: template.name,
      type: template.type,
      prompt: template.prompt,
      status: 'idle',
      width: 250
    };
    setColumns(prev => [...prev, newCol]);
    setIsLibraryOpen(false);
  };

  const handleOpenLibrary = () => {
    setAddColumnAnchor(null);
    setIsLibraryOpen(true);
  };

  const handleStopExtraction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  const handleRunAnalysis = () => {
    if (documents.length === 0 || columns.length === 0) return;
    processExtraction(documents, columns);
  };

  const handleRerunSelected = () => {
    if (selectedDocIds.size === 0 || columns.length === 0) return;
    
    // Get selected documents
    const selectedDocs = documents.filter(d => selectedDocIds.has(d.id));
    
    // Clear existing results for selected documents
    setResults(prev => {
      const next = { ...prev };
      selectedDocIds.forEach(docId => {
        delete next[docId];
      });
      return next;
    });
    
    // Run extraction on selected documents
    processExtraction(selectedDocs, columns, true);
  };

  const handleToggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleToggleAllDocSelection = () => {
    if (selectedDocIds.size === documents.length) {
      // Deselect all
      setSelectedDocIds(new Set());
    } else {
      // Select all
      setSelectedDocIds(new Set(documents.map(d => d.id)));
    }
  };

  const handleExportCSV = () => {
    if (documents.length === 0) return;

    // Headers
    const headerRow = ['Document Name', ...columns.map(c => c.name)];
    
    // Rows
    const rows = documents.map(doc => {
      const rowData = [doc.name];
      columns.forEach(col => {
        const cell = results[doc.id]?.[col.id];
        // Escape double quotes with two double quotes
        const val = cell ? cell.value.replace(/"/g, '""') : "";
        rowData.push(`"${val}"`);
      });
      return rowData.join(",");
    });

    const csvContent = [headerRow.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${projectName.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processExtraction = async (docsToProcess: DocumentFile[], colsToProcess: Column[], forceOverwrite: boolean = false) => {
    // Cancel any previous run
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Start new run
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true);
    setAnalysisError('');

    try {
      // Mark all target columns as extracting initially
      setColumns(prev => prev.map(c => colsToProcess.some(target => target.id === c.id) ? { ...c, status: 'extracting' } : c));

      // 1. Flatten all tasks: Create a list of {doc, col} pairs for every cell that needs processing
      const tasks: { doc: DocumentFile; col: Column }[] = [];
      
      for (const doc of docsToProcess) {
          for (const col of colsToProcess) {
             // Only add task if result doesn't exist or forceOverwrite is true
             if (forceOverwrite || !results[doc.id]?.[col.id]) {
                 tasks.push({ doc, col });
             }
          }
      }

      // 2. Process EVERYTHING concurrently (Simultaneous)
      // Removed batching logic as requested to maximize speed
      const failedColumns = new Set<string>();
      const promises = tasks.map(async ({ doc, col }) => {
          if (controller.signal.aborted) return;
          try {
              const data = await extractColumnData(doc, col, selectedModel, controller.signal);
              if (controller.signal.aborted) return;

              setResults(prev => ({
                  ...prev,
                  [doc.id]: {
                      ...(prev[doc.id] || {}),
                      [col.id]: data
                  }
              }));
          } catch (e) {
              if (controller.signal.aborted) return;
              failedColumns.add(col.id);
              setAnalysisError(e instanceof Error ? e.message : 'Extraction failed. Please try again.');
              console.error(`Failed to extract ${col.name} for ${doc.name}`, e);
          }
      });

      await Promise.all(promises);

      // Mark all columns as completed if finished successfully without abort
      if (!controller.signal.aborted) {
          setColumns(prev => prev.map(c => colsToProcess.some(target => target.id === c.id) ? { ...c, status: failedColumns.has(c.id) ? 'error' : 'completed' } : c));
      }

    } finally {
      // If we are still the active controller (cleanup)
      if (abortControllerRef.current === controller) {
        setIsProcessing(false);
        abortControllerRef.current = null;
        
        // Reset extracting status if stopped early (aborted)
        setColumns(prev => prev.map(c => c.status === 'extracting' ? { ...c, status: 'idle' } : c));
      }
    }
  };

  const handleCellClick = (docId: string, colId: string) => {
    const cell = results[docId]?.[colId];
    if (cell) {
      setSelectedCell({ docId, colId });
      setPreviewDocId(null);
      setSidebarMode('verify');
      setIsSidebarExpanded(false); // Reset to narrow "Answer Only" view
    }
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedCell(null);
    setPreviewDocId(docId);
    setSidebarMode('verify');
    setIsSidebarExpanded(true); // Document preview should be wide
  };

  const handleVerifyCell = () => {
    if (!selectedCell) return;
    const { docId, colId } = selectedCell;
    
    setResults(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        [colId]: {
          ...prev[docId][colId]!,
          status: 'verified'
        }
      }
    }));
  };

  const toggleChat = () => {
    if (sidebarMode === 'chat') {
      setSidebarMode('none');
    } else {
      setSidebarMode('chat');
      setSelectedCell(null);
      setPreviewDocId(null);
      setIsSidebarExpanded(false); // Chat usually is standard width
    }
  };

  // Render Helpers
  const getSidebarData = () => {
    // Priority 1: Selected Cell (Inspecting result)
    if (selectedCell) {
      return {
        cell: results[selectedCell.docId]?.[selectedCell.colId] || null,
        document: documents.find(d => d.id === selectedCell.docId) || null,
        column: columns.find(c => c.id === selectedCell.colId) || null
      };
    }
    // Priority 2: Previewed Document (Reading mode)
    if (previewDocId) {
      return {
        cell: null,
        document: documents.find(d => d.id === previewDocId) || null,
        column: null
      };
    }
    return null;
  };

  const sidebarData = getSidebarData();
  const currentModel = MODELS.find(m => m.id === selectedModel) || { id: selectedModel, name: selectedModel, description: 'OpenRouter', icon: Cpu };

  // Calculate Sidebar Width
  const getSidebarWidthClass = () => {
      if (sidebarMode === 'none') return 'w-0 translate-x-10 opacity-0 overflow-hidden';
      
      // Chat is fixed width
      if (sidebarMode === 'chat') return 'w-[400px] translate-x-0';
      
      // Verify Mode depends on expansion
      if (isSidebarExpanded) return 'w-[900px] translate-x-0'; // Wide Inspector
      return 'w-[400px] translate-x-0'; // Narrow Analyst
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
        accept=".pdf,.txt,.md,.json,.docx"
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="relative z-50 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">Tabular Review</h1>
            <div className="h-4 w-px bg-slate-300 mx-2 flex-shrink-0"></div>
            {isEditingProjectName ? (
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setIsEditingProjectName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingProjectName(false);
                }}
                className="text-sm font-medium text-slate-800 border-b border-indigo-500 outline-none bg-transparent min-w-[150px]"
                autoFocus
              />
            ) : (
              <p 
                className="text-sm text-slate-500 font-medium cursor-text hover:text-slate-800 hover:bg-slate-50 px-2 py-1 rounded transition-all select-none truncate max-w-[200px] sm:max-w-[300px]"
                onDoubleClick={() => setIsEditingProjectName(true)}
                title="Double click to rename"
              >
                {projectName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
             {/* Chat Button */}
             <button 
                onClick={toggleChat}
                className={`flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95 ${
                  sidebarMode === 'chat' 
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                  : 'bg-white hover:bg-slate-50 text-slate-600'
                }`}
                title="AI Analyst"
             >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
             </button>

             {/* Clear Button */}
             <button 
                onClick={handleClearAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 text-xs font-semibold rounded-md transition-all active:scale-95"
                title="Clear Project"
             >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
             </button>

             {/* Load Sample Button */}
             <button 
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95"
                title="Load Sample Columns"
             >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Load Sample
             </button>

             {/* Save Project Button */}
             <button 
                onClick={handleSaveProject}
                disabled={documents.length === 0 && columns.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save Project"
             >
                <Save className="w-3.5 h-3.5" />
                Save
             </button>

             {/* Load Project Button */}
             <button 
                onClick={handleLoadProject}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95"
                title="Load Project"
             >
                <FolderOpen className="w-3.5 h-3.5" />
                Load
             </button>

             {/* Export Button */}
             <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95"
                title="Export to CSV"
             >
                <Download className="w-3.5 h-3.5" />
                Export
             </button>
             
             {/* Text Wrap Button */}
             <button 
                onClick={() => setIsTextWrapEnabled(!isTextWrapEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95 ${
                  isTextWrapEnabled 
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                  : 'bg-white hover:bg-slate-50 text-slate-600'
                }`}
                title="Toggle Text Wrap"
             >
                <WrapText className={`w-3.5 h-3.5`} />
                Wrap
             </button>

             {/* Add Document Button */}
             <button 
                onClick={() => !isConverting && fileInputRef.current?.click()}
                disabled={isConverting}
                className={`flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all active:scale-95 ${isConverting ? 'opacity-70 cursor-wait' : ''}`}
                title="Add Documents"
             >
                {isConverting ? (
                    <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>Converting...</span>
                    </>
                ) : (
                    <>
                        <FilePlus className="w-3.5 h-3.5" />
                        <span>Add Document</span>
                    </>
                )}
             </button>

             <div className="h-6 w-px bg-slate-200 mx-1"></div>

             {/* Model Selector */}
             <div className="relative">
                <button 
                onClick={() => !isProcessing && setIsModelMenuOpen(!isModelMenuOpen)}
                disabled={isProcessing}
                className={`flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 transition-all ${!isProcessing ? 'hover:bg-indigo-100 active:scale-95' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className="flex items-center gap-2">
                    <currentModel.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{currentModel.name}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                
                {isModelMenuOpen && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsModelMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                          selectedModel === model.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${selectedModel === model.id ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                          <model.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{model.name}</div>
                          <div className="text-[10px] opacity-70">{model.description}</div>
                        </div>
                      </button>
                    ))}
                    <form className="border-t border-slate-100 mt-1 p-2 space-y-2" onSubmit={event => {
                      event.preventDefault();
                      if (!/^[^\s/]+\/[^\s]+$/.test(customModel.trim())) return;
                      setSelectedModel(customModel.trim());
                      setIsModelMenuOpen(false);
                    }}>
                      <label htmlFor="custom-model" className="text-xs font-semibold text-slate-600">Other OpenRouter model</label>
                      <input id="custom-model" value={customModel} onChange={event => setCustomModel(event.target.value)} placeholder="provider/model-name" required pattern="[^\s/]+/[^\s]+" className="w-full border border-slate-200 rounded px-2 py-1 text-xs" />
                      <p className="text-[10px] text-slate-500">Choose a model that supports structured outputs.</p>
                      <button type="submit" className="text-xs text-indigo-700 font-semibold">Use model</button>
                    </form>
                  </div>
                  </>
                )}
              </div>

             {/* Run / Stop Button */}
             {isProcessing ? (
                <button 
                  onClick={handleStopExtraction}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-md transition-all active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </button>
             ) : selectedDocIds.size > 0 ? (
                <button 
                  onClick={handleRerunSelected}
                  disabled={columns.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white border border-amber-500 text-xs font-bold rounded-md transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Re-run analysis on selected documents"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-run ({selectedDocIds.size})
                </button>
             ) : (
                <button 
                  onClick={handleRunAnalysis}
                  disabled={documents.length === 0 || columns.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 text-xs font-bold rounded-md transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Analysis
                </button>
             )}
          </div>
        </header>
        {analysisError && (
          <div role="alert" className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {analysisError}
            <button onClick={() => setAnalysisError('')} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {/* Workspace */}
        <main className="flex-1 flex overflow-hidden relative">
          {/* Conversion Overlay */}
          {isConverting && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100 flex flex-col items-center max-w-md text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                        <div className="relative bg-indigo-50 p-4 rounded-full">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Converting Documents</h3>
                    <p className="text-slate-500">Using local Docling engine to preserve formatting and structure...</p>
                </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0 bg-white">
             <DataGrid 
                documents={documents} 
                columns={columns} 
                results={results}
                onAddColumn={(rect) => setAddColumnAnchor(rect)}
                onEditColumn={handleEditColumn}
                onColumnResize={handleColumnResize}
                onCellClick={handleCellClick}
                onDocClick={handleDocumentClick}
                onRemoveDoc={handleRemoveDoc}
                selectedCell={selectedCell}
                isTextWrapEnabled={isTextWrapEnabled}
                onDropFiles={(files) => processUploadedFiles(files)}
                selectedDocIds={selectedDocIds}
                onToggleDocSelection={handleToggleDocSelection}
                onToggleAllDocSelection={handleToggleAllDocSelection}
             />
          </div>

          {/* Add/Edit Column Menu */}
          {addColumnAnchor && (
            <AddColumnMenu 
              triggerRect={addColumnAnchor}
              onClose={handleCloseMenu}
              onSave={handleSaveColumn}
              onDelete={handleDeleteColumn}
              modelId={selectedModel}
              initialData={editingColumnId ? columns.find(c => c.id === editingColumnId) : undefined}
              onOpenLibrary={handleOpenLibrary}
            />
          )}

          {/* Column Library Modal */}
          <ColumnLibrary
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            onSelectTemplate={handleSelectTemplate}
          />

          {/* Right Sidebar Container (Animated Width) */}
          <div 
            className={`transition-all duration-300 ease-in-out border-l border-slate-200 bg-white shadow-xl z-30 relative ${getSidebarWidthClass()}`}
          >
            <div className="w-full h-full absolute right-0 top-0 flex flex-col">
                {sidebarMode === 'verify' && sidebarData && (
                    <VerificationSidebar 
                        cell={sidebarData.cell}
                        document={sidebarData.document}
                        column={sidebarData.column}
                        onClose={() => { setSidebarMode('none'); setSelectedCell(null); setPreviewDocId(null); }}
                        onVerify={handleVerifyCell}
                        isExpanded={isSidebarExpanded}
                        onExpand={setIsSidebarExpanded}
                    />
                )}
                {sidebarMode === 'chat' && (
                    <ChatInterface 
                        documents={documents}
                        columns={columns}
                        results={results}
                        onClose={() => setSidebarMode('none')}
                        modelId={selectedModel}
                    />
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
