import React, { useState, useRef } from 'react';
import { useUpload } from '../context/UploadContext';
import { ChevronUp, ChevronDown, CheckCircle, Loader2, AlertCircle, Play, X, Eraser } from 'lucide-react';

const UploadDrawer = () => {
  const { tasks, resumeUpload, removeTask, clearTasks } = useUpload();
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter(t => t.status === 'uploading').length;
  const interruptedCount = tasks.filter(t => t.status === 'interrupted').length;

  const handleResumeClick = (taskId: string) => {
    setActiveTaskId(taskId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeTaskId) {
      resumeUpload(activeTaskId, e.target.files[0]);
      setActiveTaskId(null);
      // Reset input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div className={`fixed bottom-0 right-8 w-80 bg-heritage-900 border border-heritage-800 rounded-t-xl shadow-2xl transition-all z-50 ${isOpen ? 'h-96' : 'h-12'}`}>
      {/* Hidden input for resuming files */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="video/mp4"
        onChange={onFileSelected}
      />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 flex items-center justify-between text-sm font-black uppercase tracking-widest text-heritage-parchment"
      >
        <span className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Loader2 className="animate-spin text-heritage-gold" size={16} />
          ) : interruptedCount > 0 ? (
            <AlertCircle className="text-heritage-sunset" size={16} />
          ) : (
            <CheckCircle className="text-heritage-gold" size={16} />
          )}
          {activeCount > 0
            ? `Syncing ${activeCount} item${activeCount > 1 ? 's' : ''}`
            : interruptedCount > 0
                ? `${interruptedCount} upload${interruptedCount > 1 ? 's' : ''} interrupted`
                : 'Vault Sync Complete'}
        </span>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {isOpen && (
        <div className="flex flex-col h-80 border-t border-heritage-800 bg-heritage-900">
          <div className="flex items-center justify-between px-4 py-2 bg-heritage-black/50 border-b border-heritage-800">
            <span className="text-[10px] uppercase font-black text-heritage-400 tracking-widest">Sync History</span>
            {tasks.some(t => t.status !== 'uploading') && (
              <button
                onClick={clearTasks}
                className="flex items-center gap-1 text-[10px] uppercase font-black text-heritage-gold hover:text-heritage-parchment transition-colors"
              >
                <Eraser size={12} /> Clear Finished
              </button>
            )}
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {tasks.map(task => (
            <div key={task.id} className="space-y-2 group">
              <div className="flex justify-between text-xs">
                <span className="truncate w-40 font-bold text-heritage-parchment uppercase tracking-tighter">{task.title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-heritage-400 font-mono">{task.progress}%</span>
                    {(task.status === 'completed' || task.status === 'failed') && (
                        <button
                            onClick={() => removeTask(task.id)}
                            className="text-heritage-400 hover:text-heritage-gold opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
              </div>

              <div className="w-full h-1.5 bg-heritage-black rounded-full overflow-hidden border border-heritage-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    task.status === 'failed' ? 'bg-heritage-sunset' :
                    task.status === 'interrupted' ? 'bg-heritage-sunset/50' :
                    'bg-heritage-gold'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest">
                    {task.status === 'completed' && <><CheckCircle size={10} className="text-heritage-gold" /> <span className="text-heritage-gold">Sync Complete</span></>}
                    {task.status === 'uploading' && <><Loader2 size={10} className="text-heritage-gold animate-spin" /> <span className="text-heritage-gold">Transferring</span></>}
                    {task.status === 'interrupted' && <><AlertCircle size={10} className="text-heritage-sunset" /> <span className="text-heritage-sunset">Interrupted</span></>}
                    {task.status === 'failed' && <><AlertCircle size={10} className="text-heritage-sunset" /> <span className="text-heritage-sunset">Transfer Failed</span></>}
                </div>

                {task.status === 'interrupted' && (
                    <button
                        onClick={() => handleResumeClick(task.id)}
                        className="flex items-center gap-1 bg-heritage-gold/10 hover:bg-heritage-gold/20 text-heritage-gold px-2 py-0.5 rounded border border-heritage-gold/30 text-[10px] font-black uppercase transition-all"
                    >
                        <Play size={10} fill="currentColor" /> Resume
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default UploadDrawer;
