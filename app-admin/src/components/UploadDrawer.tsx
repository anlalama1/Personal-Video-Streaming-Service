import React, { useState, useRef } from 'react';
import { useUpload } from '../context/UploadContext';
import { ChevronUp, ChevronDown, CheckCircle, Loader2, AlertCircle, Play, X } from 'lucide-react';

const UploadDrawer = () => {
  const { tasks, resumeUpload, removeTask } = useUpload();
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
    <div className={`fixed bottom-0 right-8 w-80 bg-slate-800 border border-slate-700 rounded-t-xl shadow-2xl transition-all z-50 ${isOpen ? 'h-96' : 'h-12'}`}>
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
        className="w-full h-12 px-4 flex items-center justify-between text-sm font-bold text-slate-100"
      >
        <span className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Loader2 className="animate-spin text-blue-400" size={16} />
          ) : interruptedCount > 0 ? (
            <AlertCircle className="text-amber-400" size={16} />
          ) : (
            <CheckCircle className="text-green-400" size={16} />
          )}
          {activeCount > 0
            ? `Uploading ${activeCount} item${activeCount > 1 ? 's' : ''}`
            : interruptedCount > 0
                ? `${interruptedCount} upload${interruptedCount > 1 ? 's' : ''} interrupted`
                : 'All uploads synced'}
        </span>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 overflow-y-auto h-80 border-t border-slate-700">
          {tasks.map(task => (
            <div key={task.id} className="space-y-2 group">
              <div className="flex justify-between text-xs">
                <span className="truncate w-40 font-medium text-slate-200">{task.title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">{task.progress}%</span>
                    {(task.status === 'completed' || task.status === 'failed') && (
                        <button
                            onClick={() => removeTask(task.id)}
                            className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    task.status === 'failed' ? 'bg-red-500' :
                    task.status === 'interrupted' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
                    {task.status === 'completed' && <><CheckCircle size={10} className="text-green-400" /> <span className="text-green-400">Sync Complete</span></>}
                    {task.status === 'uploading' && <><Loader2 size={10} className="text-blue-400 animate-spin" /> <span className="text-blue-400">Transferring</span></>}
                    {task.status === 'interrupted' && <><AlertCircle size={10} className="text-amber-400" /> <span className="text-amber-400">Interrupted</span></>}
                    {task.status === 'failed' && <><AlertCircle size={10} className="text-red-400" /> <span className="text-red-400">Transfer Failed</span></>}
                </div>

                {task.status === 'interrupted' && (
                    <button
                        onClick={() => handleResumeClick(task.id)}
                        className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded border border-amber-500/50 text-[10px] font-bold uppercase transition-all"
                    >
                        <Play size={10} fill="currentColor" /> Resume
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadDrawer;
