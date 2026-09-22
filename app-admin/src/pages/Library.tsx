import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw, CheckCircle2, Clock, XCircle, AlertTriangle, Sparkles, Database, Trash2, Loader2 } from 'lucide-react';
import api from '../api';

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  transcodeStatus: string;
  hlsKey?: string;
  aiTitle?: string;
  familyId: string;
}

const Library = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await api.get('catalog?adminView=true');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch library:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId: string, familyId: string, title: string) => {
    if (!window.confirm(`Move "${title}" to trash? It will be permanently purged after the retention period.`)) return;

    setDeletingId(videoId);
    try {
      await api.delete(`catalog/${videoId}/${familyId}`);
      await fetchLibrary();
    } catch (err) {
      console.error('Deletion failed:', err);
      alert('Failed to delete item.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="flex items-center gap-1.5 text-heritage-gold bg-heritage-gold/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-gold/30"><CheckCircle2 size={14} /> Ready</span>;
      case 'REVIEW_PENDING':
        return <span className="flex items-center gap-1.5 text-heritage-gold bg-heritage-gold/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-gold/30 animate-pulse"><Sparkles size={14} /> Needs Review</span>;
      case 'UPLOADING':
        return <span className="flex items-center gap-1.5 text-heritage-400 bg-heritage-black/50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-800 animate-pulse"><Database size={14} /> Ingesting</span>;
      case 'PROCESSING':
        return <span className="flex items-center gap-1.5 text-heritage-parchment bg-heritage-gold/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-gold/30 animate-pulse"><Sparkles size={14} /> AI Analysis</span>;
      case 'TRANSCODING':
        return <span className="flex items-center gap-1.5 text-heritage-gold bg-heritage-gold/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-gold/30 animate-pulse"><Clock size={14} /> Transcoding</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1.5 text-heritage-sunset bg-heritage-sunset/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-sunset/30"><AlertTriangle size={14} /> Error</span>;
      default:
        return <span className="flex items-center gap-1.5 text-heritage-400 bg-heritage-black/50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-heritage-800">{status}</span>;
    }
  };

  return (
    <div>
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-bold text-heritage-parchment mb-2 text-glow-gold">Digital Library</h2>
          <p className="text-heritage-400">Manage your active scrolls and monitor engine health.</p>
        </div>
        <button
          onClick={fetchLibrary}
          className="flex items-center gap-2 bg-heritage-800 hover:bg-heritage-700 text-heritage-parchment px-5 py-2.5 rounded-lg border border-heritage-800 transition-all shadow-lg"
        >
          <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="bg-heritage-900 rounded-xl border border-heritage-800 shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-heritage-black/50 text-heritage-400 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-black">Title</th>
              <th className="px-6 py-4 font-black">Details</th>
              <th className="px-6 py-4 font-black text-center">Status</th>
              <th className="px-6 py-4 font-black text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-heritage-800">
            {items.map((item) => (
              <tr key={item.videoId} className={`group hover:bg-heritage-800/30 transition-colors ${item.transcodeStatus === 'REVIEW_PENDING' ? 'bg-heritage-gold/5' : ''}`}>
                <td className="px-6 py-5">
                  <div className="font-bold text-heritage-parchment flex items-center gap-2">
                    {item.transcodeStatus === 'REVIEW_PENDING' ? item.aiTitle || item.title : item.title}
                    {item.transcodeStatus === 'REVIEW_PENDING' && (
                      <Link to="/review" className="text-[10px] text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/30 hover:bg-heritage-gold/20 transition-all font-black tracking-widest uppercase">
                        Review Draft
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-heritage-400/60 font-mono">{item.videoId}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm text-heritage-parchment font-medium">{item.genre}</div>
                  <div className="text-xs text-heritage-400 font-mono">{item.releaseYear}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    {getStatusBadge(item.transcodeStatus)}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <button
                        onClick={() => handleDelete(item.videoId, item.familyId, item.title)}
                        disabled={deletingId === item.videoId}
                        className="text-heritage-400 hover:text-heritage-sunset p-2 rounded-lg hover:bg-heritage-sunset/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Move to Trash"
                    >
                        {deletingId === item.videoId ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-heritage-400 italic">No media scrolls found in your library.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Library;
