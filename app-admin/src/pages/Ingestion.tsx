import React, { useState } from 'react';
import { useUpload } from '../context/UploadContext';
import { CheckCircle2, CloudUpload } from 'lucide-react';

const Ingestion = () => {
  const { startUpload } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [familyId, setFamilyId] = useState('PUBLIC');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsSuccess(false);
    }
  };

  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFamilyId(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // Build optimized default metadata values from the raw file info
    const optimizedDefaults = {
      title: file.name.split('.')[0],
      genre: 'Unknown',
      releaseYear: new Date().getFullYear().toString(),
      familyId: familyId
    };

    // Trigger background upload chunker process
    startUpload(file, optimizedDefaults);

    setFile(null);
    setIsSuccess(true);
  };

  return (
    <div className="max-w-xl mx-auto">
      <header className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Media Vault Ingestion</h2>
        <p className="text-slate-400">Upload raw media rolls. AI will automatically draft metadata and index logs for human approval.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Family Partition</label>
          <select
            name="familyId"
            value={familyId}
            onChange={handleFamilyChange}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="PUBLIC">Public Access Pool</option>
            <option value="SMITH_HOUSE">Smith Family Collection</option>
            <option value="LALAMA_HOUSE">Lalama Family Collection</option>
          </select>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Media File (MP4)</label>
          <div className="group border-2 border-dashed border-slate-600 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-slate-700/30 transition-all cursor-pointer relative">
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <CloudUpload className="text-slate-500 group-hover:text-blue-400 transition-colors" size={44} />
              {file ? (
                <div className="text-blue-400 font-bold text-sm tracking-wide break-all">{file.name}</div>
              ) : (
                <div className="text-slate-400 font-medium text-sm italic">Click or drag and drop MP4 video here</div>
              )}
            </div>
          </div>
        </div>

        <button
          disabled={!file}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition-all shadow-2xl tracking-widest uppercase text-xs"
        >
          Begin Ingestion Pass
        </button>

        {isSuccess && (
          <div className="bg-blue-900/30 border border-blue-500 p-4 rounded-lg flex items-center gap-3 text-blue-300">
            <CheckCircle2 className="text-blue-400" size={18} />
            <span className="text-xs font-medium">Video added to background thread! Track progress in the upload drawer.</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default Ingestion;
