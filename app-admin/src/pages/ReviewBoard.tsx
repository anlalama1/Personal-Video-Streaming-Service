import { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCcw, ClipboardCheck, Sparkles, CheckCircle } from 'lucide-react';
import { SYSTEM_CONFIG } from '../config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  transcodeStatus: string;
  thumbnailUrl: string;
  aiTitle?: string;
  aiDescription?: string;
  aiTags?: string[] | string;
  videoKey: string;
  familyId: string;
}

const ReviewBoard = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    genre: 'Unknown',
    releaseYear: new Date().getFullYear().toString(),
    description: '',
    tags: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchReviewQueue = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}catalog`, {
        headers: { 'x-tenant-id': 'GLOBAL' }
      });
      // Filter for items explicitly in REVIEW_PENDING state
      const reviewItems = res.data.filter((item: MediaItem) => item.transcodeStatus === 'REVIEW_PENDING');
      setItems(reviewItems);
    } catch (err) {
      console.error('Failed to load review board data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const selectItemForReview = (item: MediaItem) => {
    setSelectedItem(item);
    setSuccessMsg('');

    // Parse tags safely if array or comma-separated string
    let formattedTags = '';
    if (item.aiTags) {
      formattedTags = Array.isArray(item.aiTags) ? item.aiTags.join(', ') : String(item.aiTags);
    }

    // Pre-fill form fields with AI generated defaults
    setFormData({
      title: item.aiTitle || item.title || '',
      genre: item.genre && item.genre !== 'Unknown' ? item.genre : 'Family Archive',
      releaseYear: item.releaseYear && item.releaseYear !== '0' ? item.releaseYear : new Date().getFullYear().toString(),
      description: item.aiDescription || '',
      tags: formattedTags
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await axios.post(`${API_BASE_URL}catalog/publish`, {
        videoId: selectedItem.videoId,
        familyId: selectedItem.familyId,
        videoKey: selectedItem.videoKey,
        title: formData.title,
        genre: formData.genre,
        releaseYear: formData.releaseYear,
        description: formData.description,
        tags: tagsArray
      }, {
        headers: { 'x-tenant-id': 'GLOBAL' }
      });

      setSuccessMsg(`"${formData.title}" officially approved and queued for full HLS transcoding!`);
      setSelectedItem(null);
      await fetchReviewQueue();
    } catch (err) {
      console.error('Publish confirmation failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="text-blue-400" /> Metadata Review Board
          </h2>
          <p className="text-slate-400">Human-in-the-Loop approval loop. Review AI metadata defaults before transcoding clusters launch.</p>
          <p className="text-[11px] text-blue-400 bg-blue-950/40 border border-blue-900/60 rounded-md px-3 py-1.5 mt-2 max-w-max flex items-center gap-1.5 italic font-medium">
            <Sparkles size={12} className="text-blue-400 animate-pulse" /> Staged properties are automatically drafted by Amazon Bedrock using the <span className="font-bold underline text-blue-300 font-mono">{SYSTEM_CONFIG.BEDROCK_MODEL_ID}</span> foundation model. Review and amend details before initializing full production HLS transcoding.
          </p>
        </div>
        <button
          onClick={fetchReviewQueue}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 transition-all text-sm"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </header>

      {successMsg && (
        <div className="bg-green-900/30 border border-green-500 p-4 rounded-lg flex items-center gap-3 text-green-300">
          <CheckCircle className="text-green-400 animate-bounce" size={20} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Queue list */}
        <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-5 h-[calc(100vh-240px)] overflow-y-auto space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Review Queue ({items.length})</h3>

          {items.map((item) => (
            <div
              key={item.videoId}
              onClick={() => selectItemForReview(item)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 items-center ${
                selectedItem?.videoId === item.videoId
                  ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900/40 border-slate-700 hover:border-slate-500 hover:bg-slate-900/80'
              }`}
            >
              <img
                src={item.thumbnailUrl}
                alt="AI thumbnail"
                className="w-20 h-14 object-cover rounded-lg border border-slate-700 bg-slate-800"
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-200 truncate">{item.aiTitle || item.title}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{item.videoId}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded w-max font-semibold border border-blue-900">
                  <Sparkles size={10} /> AI Staged
                </div>
              </div>
            </div>
          ))}

          {items.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-500 italic text-sm">
              All uploads reviewed! Queue is empty.
            </div>
          )}
        </div>

        {/* Right column - Selection form */}
        <div className="lg:col-span-2">
          {selectedItem ? (
            <form onSubmit={handlePublishSubmit} className="bg-slate-800 rounded-xl border border-slate-700 p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start border-b border-slate-700 pb-6">
                <img
                  src={selectedItem.thumbnailUrl}
                  alt="Extracted frame"
                  className="w-44 h-28 object-cover rounded-xl border border-slate-600 bg-slate-900 shadow-2xl"
                />
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Staged Video Context</span>
                  <h4 className="text-xl font-black text-white">{selectedItem.title}</h4>
                  <p className="text-xs text-slate-400 font-mono">Storage Key: {selectedItem.videoKey}</p>
                  <p className="text-xs text-slate-400 font-mono">Partition: Tenant ID (GLOBAL) | Partition ID ({selectedItem.familyId})</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  Verified Video Title <span className="text-[10px] text-blue-400 font-normal flex items-center gap-0.5"><Sparkles size={10}/> AI Auto-Suggested</span>
                </label>
                <input
                  required
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Catalog Genre</label>
                  <input
                    required
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Historical / Release Year</label>
                  <input
                    type="number"
                    required
                    name="releaseYear"
                    value={formData.releaseYear}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Detailed Description</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  placeholder="Summarize the media event context..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Tags / Index Keywords (Comma Separated)</label>
                <input
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 outline-none"
                  placeholder="e.g. wedding, 1995, family, homevideo"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition-all shadow-xl tracking-widest uppercase text-sm"
              >
                {submitting ? 'Activating Transcoding Clusters...' : 'Approve & Trigger HLS Transcode'}
              </button>
            </form>
          ) : (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-20 text-center text-slate-500 italic h-full flex flex-col justify-center items-center gap-2">
              <ClipboardCheck size={48} className="text-slate-600" />
              <span>Select a media asset from the queue to review AI summaries and launch transcoding.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewBoard;
