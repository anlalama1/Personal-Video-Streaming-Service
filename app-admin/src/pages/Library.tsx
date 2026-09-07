import { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCcw, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  transcodeStatus: string;
  hlsKey?: string;
}

const Library = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      // In MVP, we just fetch GLOBAL for now
      const res = await axios.get(`${API_BASE_URL}catalog`, {
        headers: { 'x-tenant-id': 'GLOBAL' }
      });
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch library:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="flex items-center gap-1.5 text-green-400 bg-green-950/50 px-3 py-1 rounded-full text-xs font-bold border border-green-800"><CheckCircle2 size={14} /> Ready</span>;
      case 'TRANSCODING':
        return <span className="flex items-center gap-1.5 text-blue-400 bg-blue-950/50 px-3 py-1 rounded-full text-xs font-bold border border-blue-800 animate-pulse"><Clock size={14} /> Processing</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1.5 text-orange-400 bg-orange-950/50 px-3 py-1 rounded-full text-xs font-bold border border-orange-800"><AlertTriangle size={14} /> Retrying</span>;
      case 'FATAL':
        return <span className="flex items-center gap-1.5 text-red-400 bg-red-950/50 px-3 py-1 rounded-full text-xs font-bold border border-red-800"><XCircle size={14} /> Action Required</span>;
      default:
        return <span className="flex items-center gap-1.5 text-slate-400 bg-slate-950/50 px-3 py-1 rounded-full text-xs font-bold border border-slate-800">Ingested</span>;
    }
  };

  return (
    <div>
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Digital Library</h2>
          <p className="text-slate-400">Manage your active scrolls and monitor engine health.</p>
        </div>
        <button
          onClick={fetchLibrary}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2.5 rounded-lg border border-slate-700 transition-all"
        >
          <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Title</th>
              <th className="px-6 py-4 font-semibold">Details</th>
              <th className="px-6 py-4 font-semibold text-center">Status</th>
              <th className="px-6 py-4 font-semibold">HLS Folder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {items.map((item) => (
              <tr key={item.videoId} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-100">{item.title}</div>
                  <div className="text-xs text-slate-500 font-mono">{item.videoId}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm text-slate-300">{item.genre}</div>
                  <div className="text-xs text-slate-500">{item.releaseYear}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    {getStatusBadge(item.transcodeStatus)}
                  </div>
                </td>
                <td className="px-6 py-5">
                   {item.hlsKey ? (
                     <span className="text-xs font-mono text-blue-400">{item.hlsKey}</span>
                   ) : (
                     <span className="text-xs text-slate-600">—</span>
                   )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-500 italic">No media scrolls found in your library.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Library;
