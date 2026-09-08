import React, { useState } from 'react';
import { useUpload } from '../context/UploadContext';
import { CheckCircle2, CloudUpload } from 'lucide-react';

const Ingestion = () => {
  const { startUpload } = useUpload();
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    releaseYear: new Date().getFullYear().toString(),
    familyId: 'PUBLIC'
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setIsSuccess(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // Start background upload
    startUpload(file, formData);

    // Reset form immediately
    setFormData({
        title: '',
        genre: '',
        releaseYear: new Date().getFullYear().toString(),
        familyId: 'PUBLIC'
    });
    setFile(null);
    setIsSuccess(true);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-bold text-white mb-2">New Media Ingestion</h2>
        <p className="text-slate-400">Add a high-resolution MP4 to the digital library.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 uppercase tracking-wide">Video Title</label>
          <input
            required
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="e.g. Grandma's 80th Birthday"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 uppercase tracking-wide">Genre</label>
            <input
              name="genre"
              value={formData.genre}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
              placeholder="e.g. Travel"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 uppercase tracking-wide">Year</label>
            <input
              type="number"
              name="releaseYear"
              value={formData.releaseYear}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 uppercase tracking-wide">Target Family</label>
            <select
              name="familyId"
              value={formData.familyId}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
            >
              <option value="PUBLIC">Public</option>
              <option value="SMITH_HOUSE">Smith Family</option>
              <option value="LALAMA_HOUSE">Lalama Family</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <label className="text-sm font-medium text-slate-300 uppercase tracking-wide">Source MP4</label>
          <div className="group border-2 border-dashed border-slate-600 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-slate-700/30 transition-all cursor-pointer relative">
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2">
                <CloudUpload className="text-slate-500 group-hover:text-blue-400 transition-colors" size={40} />
                {file ? (
                <div className="text-blue-400 font-bold">{file.name}</div>
                ) : (
                <div className="text-slate-500 font-medium italic">Click or drag and drop MP4 here</div>
                )}
            </div>
          </div>
        </div>

        <button
          disabled={!file}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition-all shadow-2xl tracking-widest uppercase text-sm"
        >
          Send to Pharos Engine
        </button>

        {isSuccess && (
          <div className="bg-blue-900/30 border border-blue-500 p-4 rounded-lg flex items-center gap-3 text-blue-300 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="text-blue-400" />
            <span className="text-sm font-medium">Video queued! Monitor progress in the task drawer below.</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default Ingestion;
