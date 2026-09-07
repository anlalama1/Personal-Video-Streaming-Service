import React, { useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Ingestion = () => {
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    releaseYear: new Date().getFullYear().toString(),
    familyId: 'PUBLIC'
  });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('loading');
    setErrorMessage('');
    setProgress(0);

    try {
      const tenantId = 'GLOBAL';

      /**
       * Lead Strategy: Deterministic Identity.
       * We use the filename (minus extension) as the stable videoId.
       * This ensures the React Metadata and the S3-triggered Orchestrator
       * both update the exact same record in DynamoDB.
       */
      const videoId = file.name.split('.')[0].toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const s3Key = `${tenantId}/${formData.familyId}/${file.name}`;

      // 1. Get Pre-signed URL
      const urlRes = await axios.get(`${API_BASE_URL}upload-url`, {
        params: { key: s3Key, contentType: file.type },
        headers: { 'x-tenant-id': tenantId }
      });
      const { uploadUrl } = urlRes.data;

      // 2. Upload to S3
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
          setProgress(percentCompleted);
        }
      });

      // 3. Ingest Metadata to DynamoDB
      await axios.post(`${API_BASE_URL}ingest`, {
        ...formData,
        videoId: videoId,
        videoFileName: file.name,
        thumbnailFileName: ''
      }, {
        headers: { 'x-tenant-id': tenantId }
      });

      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to ingest media.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">New Media Ingestion</h2>
        <p className="text-slate-400">Save a new digital scroll to the library.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Video Title</label>
          <input
            required
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. Christmas 1994"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Genre</label>
            <input
              name="genre"
              value={formData.genre}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
              placeholder="e.g. Family"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Release Year</label>
            <input
              type="number"
              name="releaseYear"
              value={formData.releaseYear}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Family ID</label>
            <select
              name="familyId"
              value={formData.familyId}
              onChange={handleInputChange}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 outline-none"
            >
              <option value="PUBLIC">PUBLIC (Everyone)</option>
              <option value="SMITH_HOUSE">Smith Family</option>
              <option value="JONES_HOUSE">Jones Family</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <label className="text-sm font-medium text-slate-300">Source MP4 File</label>
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {file ? (
              <div className="text-blue-400 font-medium">{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</div>
            ) : (
              <div className="text-slate-500">Click or drag and drop your high-res MP4 here</div>
            )}
          </div>
        </div>

        <button
          disabled={status === 'loading' || !file}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all shadow-lg flex items-center justify-center gap-3"
        >
          {status === 'loading' ? (
            <><Loader2 className="animate-spin" /> Uploading {progress}%</>
          ) : (
            <>Save to Library</>
          )}
        </button>

        {status === 'success' && (
          <div className="bg-green-900/30 border border-green-500 p-4 rounded-lg flex items-center gap-3 text-green-400">
            <CheckCircle2 />
            <span>Success! The Pharos Engine has been notified for transcoding.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-900/30 border border-red-500 p-4 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default Ingestion;
