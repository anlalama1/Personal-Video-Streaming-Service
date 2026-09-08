import React, { useState } from 'react';
import { useUpload } from '../context/UploadContext';
import { ChevronUp, ChevronDown, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const UploadDrawer = () => {
  const { tasks } = useUpload();
  const [isOpen, setIsOpen] = useState(false);

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter(t => t.status === 'uploading').length;

  return (
    <div className={`fixed bottom-0 right-8 w-80 bg-slate-800 border border-slate-700 rounded-t-xl shadow-2xl transition-all ${isOpen ? 'h-96' : 'h-12'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 flex items-center justify-between text-sm font-bold text-slate-100"
      >
        <span className="flex items-center gap-2">
          {activeCount > 0 && <Loader2 className="animate-spin text-blue-400" size={16} />}
          {activeCount > 0 ? `Uploading ${activeCount} file${activeCount > 1 ? 's' : ''}` : 'Uploads Complete'}
        </span>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 overflow-y-auto h-80 border-t border-slate-700">
          {tasks.map(task => (
            <div key={task.id} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="truncate w-40 font-medium text-slate-200">{task.title}</span>
                <span className="text-slate-400">{task.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${task.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold">
                {task.status === 'completed' && <><CheckCircle size={10} className="text-green-400" /> <span className="text-green-400">Complete</span></>}
                {task.status === 'uploading' && <><Loader2 size={10} className="text-blue-400 animate-spin" /> <span className="text-blue-400">Uploading</span></>}
                {task.status === 'failed' && <><AlertCircle size={10} className="text-red-400" /> <span className="text-red-400">Failed</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadDrawer;
