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
        <h2 className="text-3xl font-black text-heritage-parchment mb-2 text-glow-gold">Media Vault Ingestion</h2>
        <p className="text-heritage-400 font-medium">Upload raw media rolls. AI will automatically draft metadata and index logs for human approval.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-heritage-900 p-8 rounded-2xl border border-heritage-800 shadow-2xl space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Target Family Partition</label>
          <select
            name="familyId"
            value={familyId}
            onChange={handleFamilyChange}
            className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all cursor-pointer font-bold"
          >
            <option value="PUBLIC">Public Access Pool</option>
            <option value="SMITH_HOUSE">Smith Family Collection</option>
            <option value="LALAMA_HOUSE">Lalama Family Collection</option>
          </select>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Select Media File (MP4)</label>
          <div className="group border-2 border-dashed border-heritage-800 rounded-xl p-12 text-center hover:border-heritage-gold hover:bg-heritage-gold/5 transition-all cursor-pointer relative">
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <CloudUpload className="text-heritage-800 group-hover:text-heritage-gold transition-colors" size={44} />
              {file ? (
                <div className="text-heritage-gold font-bold text-sm tracking-wide break-all">{file.name}</div>
              ) : (
                <div className="text-heritage-400 font-bold text-xs uppercase tracking-widest italic opacity-60">Click or drag and drop MP4 video here</div>
              )}
            </div>
          </div>
        </div>

        <button
          disabled={!file}
          className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset hover:opacity-90 disabled:from-heritage-800 disabled:to-heritage-800 disabled:cursor-not-allowed text-heritage-black font-black py-4 rounded-xl transition-all shadow-2xl tracking-[0.2em] uppercase text-xs"
        >
          Begin Ingestion Pass
        </button>

        {isSuccess && (
          <div className="bg-heritage-gold/10 border border-heritage-gold/30 p-4 rounded-lg flex items-center gap-3 text-heritage-gold">
            <CheckCircle2 className="text-heritage-gold" size={18} />
            <span className="text-xs font-black uppercase tracking-wider">Video added to background thread! Track progress in the upload drawer.</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default Ingestion;
