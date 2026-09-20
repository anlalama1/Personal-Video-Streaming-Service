import { useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCcw, ClipboardCheck, Sparkles, CheckCircle, Loader2, Trash2 } from 'lucide-react';
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
      const res = await axios.get(`${API_BASE_URL}catalog?adminView=true`, {
        headers: { 'x-tenant-id': 'GLOBAL' }
      });
      // Filter for items explicitly in REVIEW_PENDING state or currently being prepared (UPLOADING/PROCESSING)
      const reviewItems = res.data.filter((item: MediaItem) =>
        ['REVIEW_PENDING', 'UPLOADING', 'PROCESSING'].includes(item.transcodeStatus)
      );
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

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`Are you sure you want to reject and purge "${selectedItem.title}"? This will move it to the trash for 30 days and then permanently delete all files.`)) return;

    setSubmitting(true);
    try {
      await axios.delete(`${API_BASE_URL}catalog/${selectedItem.videoId}/${selectedItem.familyId}`, {
        headers: { 'x-tenant-id': 'GLOBAL' }
      });

      setSuccessMsg(`"${selectedItem.title}" rejected and staged for deletion.`);
      setSelectedItem(null);
      await fetchReviewQueue();
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black text-heritage-parchment flex items-center gap-2 text-glow-gold">
            <ClipboardCheck className="text-heritage-gold" /> Metadata Review Board
          </h2>
          <p className="text-heritage-400">Human-in-the-Loop approval loop. Review AI metadata defaults before transcoding clusters launch.</p>
          <p className="text-[11px] text-heritage-gold bg-heritage-gold/10 border border-heritage-gold/20 rounded-md px-3 py-1.5 mt-2 max-w-max flex items-center gap-1.5 italic font-medium">
            <Sparkles size={12} className="text-heritage-gold animate-pulse" /> Staged properties are automatically drafted by Amazon Bedrock using the <span className="font-bold underline text-heritage-gold font-mono">{SYSTEM_CONFIG.BEDROCK_MODEL_ID}</span> foundation model. Review and amend details before initializing full production HLS transcoding.
          </p>
        </div>
        <button
          onClick={fetchReviewQueue}
          className="flex items-center gap-2 bg-heritage-800 hover:bg-heritage-700 text-heritage-parchment px-4 py-2 rounded-lg border border-heritage-800 transition-all text-sm shadow-lg"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </header>

      {successMsg && (
        <div className="bg-heritage-gold/10 border border-heritage-gold/50 p-4 rounded-lg flex items-center gap-3 text-heritage-gold">
          <CheckCircle className="text-heritage-gold animate-bounce" size={20} />
          <span className="text-sm font-black uppercase tracking-wider">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Queue list */}
        <div className="lg:col-span-1 bg-heritage-900 rounded-xl border border-heritage-800 p-5 h-[calc(100vh-240px)] overflow-y-auto space-y-4 shadow-inner">
          <h3 className="text-xs font-black uppercase tracking-widest text-heritage-400 mb-2">Review Queue ({items.length})</h3>

          {items.map((item) => {
            const isReady = item.transcodeStatus === 'REVIEW_PENDING';
            const isSelected = selectedItem?.videoId === item.videoId;

            return (
              <div
                key={item.videoId}
                onClick={() => isReady && selectItemForReview(item)}
                className={`p-4 rounded-xl border transition-all flex gap-4 items-center ${
                  !isReady
                    ? 'bg-heritage-black/20 border-heritage-800 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'bg-heritage-gold/10 border-heritage-gold shadow-lg shadow-heritage-gold/5 cursor-pointer scale-[1.02]'
                      : 'bg-heritage-black/40 border-heritage-800 hover:border-heritage-400 hover:bg-heritage-black/80 cursor-pointer'
                }`}
              >
                <div className="relative">
                  <img
                    src={item.thumbnailUrl || "https://via.placeholder.com/150"}
                    alt="AI thumbnail"
                    className="w-20 h-14 object-cover rounded-lg border border-heritage-800 bg-heritage-900"
                  />
                  {!isReady && (
                    <div className="absolute inset-0 bg-heritage-black/60 rounded-lg flex items-center justify-center">
                      <Loader2 size={16} className="text-heritage-gold animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-heritage-parchment truncate">{item.aiTitle || item.title}</div>
                  <div className="text-xs text-heritage-400/60 font-mono truncate">{item.videoId}</div>

                  {isReady ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded w-max font-black border border-heritage-gold/20 uppercase tracking-tighter">
                      <Sparkles size={10} /> AI Staged
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-heritage-sunset bg-heritage-sunset/10 px-2 py-0.5 rounded w-max font-black border border-heritage-sunset/20 uppercase tracking-tighter">
                      <Loader2 size={10} className="animate-spin" /> AI Processing...
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && !loading && (
            <div className="text-center py-20 text-heritage-400 italic text-sm">
              All uploads reviewed! Queue is empty.
            </div>
          )}
        </div>

        {/* Right column - Selection form */}
        <div className="lg:col-span-2">
          {selectedItem ? (
            <form onSubmit={handlePublishSubmit} className="bg-heritage-900 rounded-2xl border border-heritage-800 p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start border-b border-heritage-800 pb-6">
                <img
                  src={selectedItem.thumbnailUrl}
                  alt="Extracted frame"
                  className="w-44 h-28 object-cover rounded-xl border border-heritage-800 bg-heritage-black shadow-2xl"
                />
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-gold">Staged Video Context</span>
                  <h4 className="text-xl font-black text-heritage-parchment">{selectedItem.title}</h4>
                  <p className="text-xs text-heritage-400 font-mono opacity-60">Key: {selectedItem.videoKey}</p>
                  <p className="text-xs text-heritage-400 font-mono opacity-60">Partition: {selectedItem.familyId}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400 flex items-center gap-1.5">
                  Verified Video Title <span className="text-[10px] text-heritage-gold font-normal flex items-center gap-0.5"><Sparkles size={10}/> AI Auto-Suggested</span>
                </label>
                <input
                  required
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-3 text-heritage-parchment focus:ring-2 focus:ring-heritage-gold outline-none transition-all font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Catalog Genre</label>
                  <input
                    required
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-2.5 text-heritage-parchment outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Historical / Release Year</label>
                  <input
                    type="number"
                    required
                    name="releaseYear"
                    value={formData.releaseYear}
                    onChange={handleInputChange}
                    className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-2.5 text-heritage-parchment outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Detailed Description</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all resize-none font-medium leading-relaxed"
                  placeholder="Summarize the media event context..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Tags / Index Keywords (Comma Separated)</label>
                <input
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-2.5 text-heritage-gold font-mono outline-none"
                  placeholder="e.g. wedding, 1995, family, homevideo"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReject}
                    className="flex items-center justify-center gap-2 bg-heritage-black hover:bg-heritage-sunset/10 text-heritage-400 hover:text-heritage-sunset px-6 py-4 rounded-xl transition-all border border-heritage-800 hover:border-heritage-sunset/50 font-black uppercase text-xs tracking-widest"
                >
                    <Trash2 size={16} /> Reject & Purge
                </button>

                <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-heritage-gold to-heritage-sunset hover:opacity-90 disabled:from-heritage-800 disabled:to-heritage-800 disabled:cursor-not-allowed text-heritage-black font-black py-4 rounded-xl transition-all shadow-xl tracking-[0.2em] uppercase text-sm"
                >
                    {submitting ? 'Activating Clusters...' : 'Approve & Trigger HLS'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-heritage-900/40 border border-dashed border-heritage-800 rounded-2xl p-20 text-center text-heritage-400 italic h-full flex flex-col justify-center items-center gap-4">
              <ClipboardCheck size={64} className="text-heritage-800" />
              <span className="max-w-xs leading-loose">Select a media asset from the queue to review AI summaries and launch transcoding.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewBoard;
