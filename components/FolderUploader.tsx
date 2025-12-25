import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  FolderUp, Archive, Download, RefreshCw, FileBox, 
  Settings, ChevronRight, ChevronDown, Check, X, Minus,
  FileText, Folder, Lock, Zap, Code2, Music, Image as ImageIcon, Film, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useZip } from '../hooks/useZip';
import { getFilesFromDataTransferItems, buildFileTree, formatBytes, DEV_EXCLUSIONS } from '../utils/fileUtils';
import { ProcessedFile, ZipSettings, FileTreeNode } from '../types';
import { toast } from 'sonner';
import { playSound } from '../utils/soundUtils';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const FileIcon = ({ name, isDir }: { name: string; isDir: boolean }) => {
  if (isDir) return <Folder className="text-cyan-400" size={16} />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'png', 'svg', 'gif'].includes(ext || '')) return <ImageIcon className="text-purple-400" size={16} />;
  if (['mp4', 'mov', 'webm'].includes(ext || '')) return <Film className="text-rose-400" size={16} />;
  if (['mp3', 'wav'].includes(ext || '')) return <Music className="text-yellow-400" size={16} />;
  if (['js', 'ts', 'tsx', 'json', 'html', 'css', 'py'].includes(ext || '')) return <Code2 className="text-emerald-400" size={16} />;
  return <FileText className="text-slate-400" size={16} />;
};

const Checkbox = ({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) => (
  <div 
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={cn(
      "w-4 h-4 rounded-sm border flex items-center justify-center mr-3 transition-all cursor-pointer shrink-0 active:scale-95",
      checked || indeterminate
        ? "bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" 
        : "border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10"
    )}
  >
    {checked && <Check size={10} className="text-black font-extrabold" strokeWidth={4} />}
    {!checked && indeterminate && <Minus size={10} className="text-black font-extrabold" strokeWidth={4} />}
  </div>
);

const TreeNode: React.FC<{ 
  node: FileTreeNode; 
  depth?: number;
  onToggle: (path: string, isDir: boolean, selected: boolean) => void;
}> = ({ node, depth = 0, onToggle }) => {
  const [expanded, setExpanded] = useState(depth < 1);
  
  return (
    <div className="select-none font-light">
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center py-2 hover:bg-white/5 rounded-lg px-2 text-sm text-slate-300 transition-colors cursor-pointer group",
          depth === 0 && "mb-1"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn("mr-2 transition-transform duration-200 shrink-0", expanded ? "rotate-90" : "")}>
          {node.children ? <ChevronRight size={12} className="text-white/40 group-hover:text-white" /> : <span className="w-3 block" />}
        </span>
        
        <Checkbox 
          checked={node.selected} 
          indeterminate={node.indeterminate}
          onChange={() => onToggle(node.path, node.isDir, node.selected)} 
        />

        <span className="mr-3 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
          <FileIcon name={node.name} isDir={node.isDir} />
        </span>
        <span className={cn("truncate flex-1 tracking-wide transition-colors", node.selected ? "text-slate-200 group-hover:text-white" : "text-slate-600")}>
          {node.name}
        </span>
        <span className="text-xs text-slate-500 font-mono group-hover:text-slate-400 ml-2">{formatBytes(node.size)}</span>
      </motion.div>
      <AnimatePresence>
        {expanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1} onToggle={onToggle} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Liquid Progress Button ---
const LiquidButton = ({ 
  progress, 
  onClick, 
  status, 
  disabled 
}: { 
  progress: number; 
  onClick: () => void; 
  status: string;
  disabled: boolean;
}) => {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className="relative w-full h-14 bg-slate-800/50 rounded-xl overflow-hidden border border-white/10 group shadow-lg"
    >
      {/* Liquid Fill */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 via-cyan-500 to-blue-500"
        initial={{ height: "0%" }}
        animate={{ height: `${progress}%` }}
        transition={{ type: "spring", stiffness: 20, damping: 10 }}
      />
      
      {/* Wave effect overlay on top of liquid */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 h-2 bg-white/20 blur-[2px]"
        animate={{ bottom: `${progress}%` }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 z-10 mix-blend-plus-lighter">
         {status === 'processing' ? (
           <>
             <RefreshCw className="animate-spin text-white" size={20} />
             <span className="font-semibold tracking-widest text-white uppercase text-sm">Processing</span>
           </>
         ) : status === 'ready' ? (
           <>
             <Download className="text-white animate-bounce" size={20} />
             <span className="font-bold tracking-widest text-white uppercase text-sm">Download Zip</span>
           </>
         ) : (
           <>
             <Archive className="text-cyan-200" size={20} />
             <span className="font-semibold tracking-widest text-cyan-50 uppercase text-sm">Compress Now</span>
           </>
         )}
      </div>
    </motion.button>
  );
};

// --- Magnetic Drop Zone ---
const MagneticDropZone = ({ onDrop, onClick, isDragging }: { onDrop: any; onClick: any; isDragging: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((e.clientX - centerX) / 10);
    y.set((e.clientY - centerY) / 10);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x: mouseX, y: mouseY }}
      className={cn(
        "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 h-64 flex flex-col items-center justify-center gap-4 overflow-hidden",
        isDragging 
          ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_50px_rgba(34,211,238,0.2)] scale-105" 
          : "border-white/10 hover:border-cyan-500/50 bg-white/5 hover:bg-white/10"
      )}
    >
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-cyan-500/5 group-hover:to-cyan-500/10 transition-colors" />

      <motion.div 
        animate={isDragging ? { scale: 1.1, rotate: 10 } : { scale: 1, rotate: 0 }}
        className="relative z-10 bg-gradient-to-br from-slate-800 to-black p-5 rounded-2xl border border-white/10 shadow-2xl"
      >
        <FolderUp size={40} className="text-cyan-400" />
      </motion.div>

      <div className="relative z-10 text-center space-y-2">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          Drop Directory Here
        </h3>
        <p className="text-sm text-slate-400">or click to browse</p>
      </div>

      {/* Scanning Line Animation */}
      {isDragging && (
        <motion.div 
          className="absolute top-0 left-0 right-0 h-1 bg-cyan-400 blur-sm shadow-[0_0_20px_#22d3ee]"
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
};

// --- Main Component ---
export const FolderUploader: React.FC = () => {
  const { 
    status, progress, fileName, setFileName, fileCount, 
    zipBlob, stats, error, compressFiles, reset, downloadZip, abortCompression, currentFile
  } = useZip();

  const [isDragging, setIsDragging] = useState(false);
  const [treeRoot, setTreeRoot] = useState<FileTreeNode[]>([]);
  const [activeFiles, setActiveFiles] = useState<ProcessedFile[]>([]);
  
  // Settings
  const [settings, setSettings] = useState<ZipSettings>({
    compressionLevel: 5,
    devMode: false,
    exclusionPatterns: [],
    addTimestamp: false,
    readmeContent: '',
    password: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Dev Mode to Exclusion Patterns
  useEffect(() => {
    if (settings.devMode) {
      setSettings(s => ({ ...s, exclusionPatterns: [...new Set([...s.exclusionPatterns, ...DEV_EXCLUSIONS])] }));
    } else {
      setSettings(s => ({ ...s, exclusionPatterns: s.exclusionPatterns.filter(p => !DEV_EXCLUSIONS.includes(p)) }));
    }
  }, [settings.devMode]);

  // Rebuild tree when files or their selection status changes
  useEffect(() => {
    if (activeFiles.length > 0) {
      setTreeRoot(buildFileTree(activeFiles));
    }
  }, [activeFiles]);

  // Handle file selection toggle in tree
  const handleToggle = useCallback((path: string, isDir: boolean, currentSelected: boolean) => {
    // If indeterminate (selected=false, indeterminate=true), we want to Select All (true).
    // If selected (selected=true), we want to Deselect All (false).
    // If unselected (selected=false), we want to Select All (true).
    // Logic: !currentSelected handles all these cases correctly assuming indeterminate passes selected=false.
    const newSelected = !currentSelected;

    setActiveFiles(prev => prev.map(f => {
      // If it matches path or is a child of the directory path
      if (f.path === path || (isDir && f.path.startsWith(path + '/'))) {
        return { ...f, selected: newSelected };
      }
      return f;
    }));
  }, []);

  // Handle Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    playSound('drop');
    if (e.dataTransfer.items) {
      try {
        const processed = await getFilesFromDataTransferItems(e.dataTransfer.items, settings.exclusionPatterns);
        handleFilesSelected(processed);
      } catch (err) {
        toast.error("Failed to read files");
      }
    }
  };

  const handleFilesSelected = (files: ProcessedFile[]) => {
    if (files.length === 0) {
      toast.error("No valid files found (check filters)");
      return;
    }
    setActiveFiles(files);
    playSound('click');
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const fileList = Array.from(e.target.files);
      const processed: ProcessedFile[] = fileList.map((file: File) => ({
        file, path: file.webkitRelativePath || file.name, selected: true, size: file.size
      }));
      handleFilesSelected(processed);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    if (zipBlob && fileName) {
       const url = URL.createObjectURL(zipBlob);
       e.dataTransfer.setData("DownloadURL", `application/zip:${fileName}:${url}`);
    }
  };

  const handleReset = useCallback(() => {
    reset();
    setActiveFiles([]);
    setTreeRoot([]);
    setFileName('');
  }, [reset, setFileName]);

  // Calculate stats for current selection
  const selectedCount = activeFiles.filter(f => f.selected).length;
  const selectedSize = activeFiles.filter(f => f.selected).reduce((acc, f) => acc + f.size, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Ultra Glass Container */}
      <div 
        className={cn(
          "relative overflow-hidden rounded-[2rem] border border-white/10 backdrop-blur-xl bg-slate-950/40 shadow-2xl transition-all duration-500",
          isDragging ? "ring-2 ring-cyan-400/50 scale-[1.02]" : ""
        )}
        onDragOver={(e) => { e.preventDefault(); if(status === 'idle') setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={status === 'idle' ? handleDrop : undefined}
      >
        {/* Breathing Glow */}
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-blue-500/10 pointer-events-none"
        />

        <div className="relative z-10 p-5 md:p-10">
          
          <AnimatePresence mode="wait">
            
            {/* --- IDLE STATE --- */}
            {status === 'idle' && activeFiles.length === 0 && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <MagneticDropZone 
                  isDragging={isDragging} 
                  onDrop={handleDrop} 
                  onClick={() => fileInputRef.current?.click()} 
                />
                
                {/* Quick Toggles */}
                <div className="flex justify-center gap-6">
                  <button 
                    onClick={() => setSettings(s => ({...s, devMode: !s.devMode}))}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-all",
                      settings.devMode 
                        ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300" 
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    <Code2 size={14} />
                    Dev Mode {settings.devMode ? 'ON' : 'OFF'}
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400">
                    <Zap size={14} className={settings.compressionLevel > 0 ? "text-yellow-400" : "text-slate-600"} />
                    <select 
                      value={settings.compressionLevel}
                      onChange={(e) => setSettings(s => ({...s, compressionLevel: Number(e.target.value) as any}))}
                      className="bg-transparent outline-none text-slate-200 cursor-pointer"
                    >
                      <option value="0">Store (Fast)</option>
                      <option value="5">Deflate (Normal)</option>
                      <option value="9">Deflate (Max)</option>
                    </select>
                  </div>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" multiple webkitdirectory="" onChange={handleFileInput} />
              </motion.div>
            )}

            {/* --- PREVIEW / CONFIG STATE --- */}
            {status === 'idle' && activeFiles.length > 0 && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid md:grid-cols-[1.5fr,1fr] gap-8 md:h-[500px]"
              >
                {/* Left: Tree View */}
                <div className="flex flex-col h-[45vh] md:h-full bg-black/20 rounded-xl border border-white/5 p-4 overflow-hidden">
                   <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2 text-white">
                        <Folder className="text-cyan-400" size={18} />
                        <span className="font-semibold">Payload Content</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-mono">{selectedCount} files selected</div>
                        <div className="text-[10px] text-slate-500 font-mono">{formatBytes(selectedSize)} total</div>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto glass-scrollbar pr-2 min-h-0">
                      {treeRoot.map(node => (
                        <TreeNode 
                          key={node.id} 
                          node={node} 
                          onToggle={handleToggle} 
                        />
                      ))}
                   </div>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-col justify-between space-y-6">
                  <div className="space-y-6">
                    <div>
                       <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Output Filename</label>
                       <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-3 focus-within:ring-2 focus-within:ring-cyan-500/50 transition-all">
                          <FileBox size={16} className="text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="archive.zip"
                            value={fileName || ""}
                            className="bg-transparent border-none w-full p-3 text-sm text-white focus:outline-none placeholder-slate-600"
                            onChange={(e) => setFileName(e.target.value)}
                          />
                       </div>
                    </div>
                    
                    <div>
                       <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Encryption (Optional)</label>
                       <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-3 focus-within:ring-2 focus-within:ring-cyan-500/50 transition-all">
                          <Lock size={16} className="text-slate-500" />
                          <input 
                            type="password" 
                            value={settings.password}
                            onChange={(e) => setSettings(s => ({...s, password: e.target.value}))}
                            placeholder="Set password..."
                            className="bg-transparent border-none w-full p-3 text-sm text-white focus:outline-none placeholder-slate-600"
                          />
                       </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5">
                       <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                         <Zap size={14} className="text-yellow-400" /> Smart Config
                       </h4>
                       <div className="text-xs text-slate-400 space-y-1">
                          <p>• Compression: Level {settings.compressionLevel}</p>
                          <p>• Encryption: <span className={settings.password ? "text-cyan-400 font-semibold" : "text-slate-500"}>
                            {settings.password ? 'Secure Container (AES-256)' : 'None'}
                          </span></p>
                          <p>• Filters: {settings.devMode ? 'Dev Mode (Node/Git Excluded)' : 'Standard'}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                     <LiquidButton 
                       progress={0} 
                       onClick={() => compressFiles(activeFiles, settings, fileName || undefined)} 
                       status="idle" 
                       disabled={selectedCount === 0}
                     />
                     <button onClick={handleReset} className="w-full py-3 text-sm text-slate-500 hover:text-white transition-colors">
                       Cancel & Reset
                     </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- PROCESSING & DONE STATE --- */}
            {(status === 'processing' || status === 'ready' || status === 'error') && (
              <motion.div
                 key="processing"
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="flex flex-col items-center justify-center min-h-[400px] text-center max-w-md mx-auto"
              >
                 {status === 'error' ? (
                    <div className="text-red-400">
                       <AlertCircle size={48} className="mx-auto mb-4" />
                       <h3 className="text-xl font-bold mb-2">System Failure</h3>
                       <p className="text-sm opacity-80 mb-6">{error}</p>
                       <button onClick={handleReset} className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20">Restart</button>
                    </div>
                 ) : (
                   <>
                     {/* Slot Machine Counter */}
                     <div className="mb-8">
                        <div className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500 tracking-tighter">
                          {status === 'ready' ? '100' : progress.toFixed(0)}%
                        </div>
                        <div className="text-sm text-cyan-400 font-mono mt-2 tracking-[0.2em] uppercase">
                          {status === 'ready' ? 'Process Complete' : 'Compressing Assets'}
                        </div>
                     </div>

                     {status === 'processing' && (
                       <p className="text-slate-500 text-xs font-mono truncate max-w-[250px] animate-pulse mb-8">
                         {fileCount} files • {currentFile.split('/').pop() || 'Loading...'}
                       </p>
                     )}

                     {status === 'ready' && stats && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-2 gap-4 w-full mb-8"
                        >
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                             <div className="text-xs text-slate-500 uppercase">Input Size</div>
                             <div className="text-lg font-bold">{formatBytes(stats.originalSize)}</div>
                          </div>
                          <div className="bg-cyan-500/10 p-4 rounded-xl border border-cyan-500/20">
                             <div className="text-xs text-cyan-400 uppercase">Final Size</div>
                             <div className="text-lg font-bold text-white">{formatBytes(stats.compressedSize)}</div>
                          </div>
                        </motion.div>
                     )}

                     <div className="w-full">
                        <LiquidButton 
                          progress={status === 'ready' ? 100 : progress} 
                          onClick={downloadZip} 
                          status={status} 
                          disabled={status === 'processing'}
                        />
                     </div>

                     {status === 'ready' && (
                       <motion.p 
                         initial={{ opacity: 0 }} 
                         animate={{ opacity: 1 }} 
                         transition={{ delay: 0.5 }}
                         className="mt-4 text-xs text-slate-500"
                       >
                         Drag the button to your desktop to save instantly.
                       </motion.p>
                     )}
                     
                     {status === 'ready' && (
                        <button onClick={handleReset} className="mt-8 text-slate-500 hover:text-white text-sm flex items-center gap-2 transition-colors">
                           <RefreshCw size={14} /> Process New Batch
                        </button>
                     )}
                   </>
                 )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};