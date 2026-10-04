/**
 * ============================================================================
 * Family Vault Consumer Upload & Review Page
 * ============================================================================
 * Enterprise Architecture Strategy: Self-Serve Family Memory Ingestion.
 * Enables family members to upload raw video memories directly to their assigned
 * Family Vault (s3://MediaSourceBucket/<familyId>/) and review Bedrock AI metadata drafts.
 */

import React, { useState, useEffect } from 'react';
import { useUpload } from '../context/UploadContext';
import { useAuth } from '../context/AuthContext';
import { CloudUpload, CheckCircle2, ClipboardCheck, Sparkles, Key, Loader2, Trash2 } from 'lucide-react';
import api from '../api';

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  aiGenre?: string;
  releaseYear: string;
  transcodeStatus: string;
  thumbnailUrl: string;
  description?: string;
  aiTitle?: string;
  aiDescription?: string;
  aiTags?: string[] | string;
  videoKey: string;
  familyId: string;
  useAi?: boolean;
}

const DEFAULT_HERITAGE_GENRES = [
  'Holidays, Birthdays and Special Occasions',
  'Daily Life',
  'Friends and Family',
  'Milestones',
  'School, Sports and Hobbies',
  'Travel and Vacation',
  'Reunions and Gatherings',
  'Miscellaneous'
];

const ConsumerUpload = () => {
  const { startUpload } = useUpload();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'upload' | 'review'>('upload');

  const [file, setFile] = useState<File | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Family Review Queue State
  const [reviewItems, setReviewItems] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<string[]>(DEFAULT_HERITAGE_GENRES);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    genre: 'Holidays, Birthdays and Special Occasions',
    releaseYear: new Date().getFullYear().toString(),
    description: '',
    tags: ''
  });

  // Fetch Heritage Genres from backend
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await api.get('genres');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setGenres(res.data.map((g: any) => g.genreName || g));
        }
      } catch (err) {
        console.warn('Using default Heritage Genres:', err);
      }
    };
    fetchGenres();
  }, []);

  // Fetch Family Vault Review Queue
  const fetchFamilyQueue = async () => {
    setLoadingReview(true);
    try {
      const res = await api.get('catalog?adminView=true');
      const pending = res.data.filter((item: MediaItem) =>
        ['REVIEW_PENDING', 'UPLOADING', 'PROCESSING'].includes(item.transcodeStatus)
      );
      setReviewItems(pending.filter((item: MediaItem) =>
        ['REVIEW_PENDING', 'UPLOADING', 'PROCESSING'].includes(item.transcodeStatus)
      ));
    } catch (err) {
      console.error('Failed to load family review queue:', err);
    } finally {
      setLoadingReview(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'review') {
      fetchFamilyQueue();
    }
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsSuccess(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userProfile.familyId) return;

    const useAi = localStorage.getItem('alexandria_enable_ai') === 'true';

    const metadata = {
      title: file.name.split('.')[0],
      genre: 'Miscellaneous',
      releaseYear: new Date().getFullYear().toString(),
      familyId: userProfile.familyId,
      useAi
    };

    startUpload(file, metadata);
    setFile(null);
    setIsSuccess(true);
  };

  const selectItemForReview = (item: MediaItem) => {
    setSelectedItem(item);
    setSuccessMsg('');

    let formattedTags = '';
    if (item.useAi && item.aiTags) {
      formattedTags = Array.isArray(item.aiTags) ? item.aiTags.join(', ') : String(item.aiTags);
    }

    const selectedGenre = (item.useAi && item.aiGenre) || item.genre || 'Holidays, Birthdays and Special Occasions';

    setFormData({
      title: (item.useAi && item.aiTitle) || item.title || '',
      genre: genres.includes(selectedGenre) ? selectedGenre : genres[0] || 'Miscellaneous',
      releaseYear: item.releaseYear && item.releaseYear !== '0' ? item.releaseYear : new Date().getFullYear().toString(),
      description: (item.useAi && item.aiDescription) || item.description || '',
      tags: formattedTags
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !userProfile.familyId) return;

    setSubmitting(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await api.post('catalog/publish', {
        videoId: selectedItem.videoId,
        familyId: userProfile.familyId,
        videoKey: selectedItem.videoKey,
        title: formData.title,
        genre: formData.genre,
        releaseYear: formData.releaseYear,
        description: formData.description,
        tags: tagsArray
      });

      setSuccessMsg(`"${formData.title}" published to your Family Vault!`);
      setSelectedItem(null);
      await fetchFamilyQueue();
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !window.confirm(`Permanently remove "${selectedItem.title}" from the review queue?`)) return;

    setRejecting(true);
    try {
      await api.delete(`catalog/${selectedItem.videoId}/${selectedItem.familyId}/reject`);
      setSuccessMsg(`"${selectedItem.title}" was rejected and removed.`);
      setSelectedItem(null);
      await fetchFamilyQueue();
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="pt-28 pb-20 px-8 lg:px-12 max-w-4xl mx-auto space-y-8">
      {/* Header & Vault Context Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-heritage-800 pb-6">
        <div>
          <h2 className="text-3xl font-black text-heritage-parchment flex items-center gap-3">
            Family Vault Ingestion
          </h2>
          <p className="text-xs text-heritage-400 font-medium mt-1">
            Upload family video memories to your secure digital vault.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-heritage-gold/10 border border-heritage-gold/30 px-3 py-1.5 rounded-xl text-heritage-gold font-mono text-xs font-bold">
          <Key size={14} />
          <span>Vault: {userProfile.familyId || 'Loading...'}</span>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex gap-4 border-b border-heritage-800 pb-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'upload'
              ? 'border-heritage-gold text-heritage-gold'
              : 'border-transparent text-heritage-400 hover:text-heritage-parchment'
          }`}
        >
          1. Upload Memories
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'review'
              ? 'border-heritage-gold text-heritage-gold'
              : 'border-transparent text-heritage-400 hover:text-heritage-parchment'
          }`}
        >
          <span>2. Family Review Queue</span>
          {reviewItems.length > 0 && (
            <span className="bg-heritage-gold text-heritage-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {reviewItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Upload Pane */}
      {activeTab === 'upload' && (
        <form onSubmit={handleUploadSubmit} className="bg-heritage-900 p-8 rounded-2xl border border-heritage-800 shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Select MP4 Memory File</label>
            <div className="group border-2 border-dashed border-heritage-800 rounded-2xl p-12 text-center hover:border-heritage-gold hover:bg-heritage-gold/5 transition-all cursor-pointer relative">
              <input
                type="file"
                accept="video/mp4"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <CloudUpload className="text-heritage-800 group-hover:text-heritage-gold transition-colors" size={48} />
                {file ? (
                  <div className="text-heritage-gold font-bold text-sm tracking-wide break-all">{file.name}</div>
                ) : (
                  <div className="text-heritage-400 font-bold text-xs uppercase tracking-widest italic opacity-70">
                    Click or drag and drop MP4 home video here
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            disabled={!file}
            className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset hover:opacity-90 disabled:from-heritage-800 disabled:to-heritage-800 disabled:cursor-not-allowed text-heritage-black font-black py-4 rounded-xl transition-all shadow-xl tracking-[0.2em] uppercase text-xs"
          >
            Upload to Family Vault
          </button>

          {isSuccess && (
            <div className="bg-heritage-gold/10 border border-heritage-gold/30 p-4 rounded-xl flex items-center gap-3 text-heritage-gold">
              <CheckCircle2 className="text-heritage-gold" size={20} />
              <span className="text-xs font-black uppercase tracking-wider">
                Upload initiated! Switch to the Review Queue tab when processing is complete.
              </span>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: Family Review Board */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          {successMsg && (
            <div className="bg-heritage-gold/10 border border-heritage-gold/50 p-4 rounded-xl flex items-center gap-3 text-heritage-gold">
              <CheckCircle2 className="text-heritage-gold" size={20} />
              <span className="text-xs font-black uppercase tracking-wider">{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Review Queue List */}
            <div className="lg:col-span-1 bg-heritage-900 border border-heritage-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-heritage-400 mb-2">
                Pending Review ({reviewItems.length})
              </h3>

              {reviewItems.map(item => {
                const isReady = item.transcodeStatus === 'REVIEW_PENDING';
                const isSelected = selectedItem?.videoId === item.videoId;

                return (
                  <div
                    key={item.videoId}
                    onClick={() => isReady && selectItemForReview(item)}
                    className={`p-3 rounded-xl border transition-all flex gap-3 items-center ${
                      !isReady
                        ? 'bg-heritage-black/20 border-heritage-800 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-heritage-gold/10 border-heritage-gold'
                          : 'bg-heritage-black/40 border-heritage-800 hover:border-heritage-400 cursor-pointer'
                    }`}
                  >
                    <img
                      src={item.thumbnailUrl || "https://via.placeholder.com/150"}
                      alt="thumbnail"
                      className="w-16 h-12 object-cover rounded-lg border border-heritage-800 bg-heritage-black"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-heritage-parchment truncate text-xs">{item.useAi && item.aiTitle ? item.aiTitle : item.title}</p>
                      {isReady ? (
                        <span className="text-[9px] text-heritage-gold bg-heritage-gold/10 px-1.5 py-0.5 rounded font-black border border-heritage-gold/20 flex items-center gap-1 w-max mt-1">
                          <Sparkles size={8} /> AI Staged
                        </span>
                      ) : (
                        <span className="text-[9px] text-heritage-sunset bg-heritage-sunset/10 px-1.5 py-0.5 rounded font-black border border-heritage-sunset/20 flex items-center gap-1 w-max mt-1">
                          <Loader2 size={8} className="animate-spin" /> Processing...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {!loadingReview && reviewItems.length === 0 && (
                <div className="py-12 text-center text-heritage-400 italic text-xs">
                  No videos pending review in your family vault.
                </div>
              )}
            </div>

            {/* Right Column: Metadata Approval Form */}
            <div className="lg:col-span-2">
              {selectedItem ? (
                <form onSubmit={handlePublishSubmit} className="bg-heritage-900 border border-heritage-800 rounded-2xl p-6 shadow-2xl space-y-4">
                  <div className="flex gap-4 items-center border-b border-heritage-800 pb-4">
                    <img
                      src={selectedItem.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-28 h-20 object-cover rounded-lg border border-heritage-800 bg-heritage-black"
                    />
                    <div>
                      <h4 className="font-black text-heritage-parchment text-lg">{selectedItem.title}</h4>
                      <p className="text-xs text-heritage-400 font-mono opacity-60">{selectedItem.videoKey}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-heritage-400">Verified Title</label>
                    <input
                      required
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-3 py-2 text-heritage-parchment outline-none font-bold text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-heritage-400">Heritage Genre</label>
                      <select
                        name="genre"
                        value={formData.genre}
                        onChange={handleInputChange}
                        className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-3 py-2 text-heritage-parchment outline-none font-bold text-xs cursor-pointer"
                      >
                        {genres.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-heritage-400">Release Year</label>
                      <input
                        type="number"
                        name="releaseYear"
                        value={formData.releaseYear}
                        onChange={handleInputChange}
                        className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-3 py-2 text-heritage-parchment outline-none font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-heritage-400">Description (Optional)</label>
                    <textarea
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-3 py-2 text-heritage-parchment outline-none text-xs font-medium resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={submitting || rejecting}
                      onClick={handleReject}
                      className="flex items-center justify-center gap-2 border border-heritage-sunset/50 text-heritage-sunset px-4 py-3 rounded-xl uppercase tracking-widest text-xs font-black"
                    >
                      <Trash2 size={14} /> {rejecting ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || rejecting}
                      className="flex-1 bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-3 rounded-xl uppercase tracking-widest text-xs shadow-xl"
                    >
                      {submitting ? 'Publishing...' : 'Publish to Family Vault'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-heritage-900/40 border border-dashed border-heritage-800 rounded-2xl p-12 text-center text-heritage-400 italic text-xs h-full flex flex-col items-center justify-center gap-2">
                  <ClipboardCheck size={40} className="text-heritage-800" />
                  <span>Select a video from the queue to finalize AI metadata drafts.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsumerUpload;
