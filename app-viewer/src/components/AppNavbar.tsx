/**
 * ============================================================================
 * Desktop Viewer Header Navigation Bar, Search Overlay & Account Profile Modal
 * ============================================================================
 * Enterprise Architecture Strategy: Responsive Header & Search Ranking Engine.
 * Serves as global layout navigation header featuring "Logo-as-a-Letter" lockup,
 * top-right search button trigger, reactive 3-tier priority search ranking,
 * interactive Account Details Modal, and AWS Zero-Training Guarantee Disclosures.
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, Key, Mail, ShieldCheck, X, Copy, Sparkles, HelpCircle, Search, Film } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  thumbnailUrl: string;
  videoUrl: string;
  description: string;
  tags: string[];
}

interface RankedResult {
  video: MediaItem;
  priority: number; // 1 = Title Prefix, 2 = Title Substring, 3 = Description
  matchType: string;
}

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAiDisclosure, setShowAiDisclosure] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Search Engine State
  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RankedResult[]>([]);

  // Default setting: Manual Mode (No-AI) is false
  const [enableAi, setEnableAi] = useState<boolean>(() => {
    return localStorage.getItem('alexandria_enable_ai') === 'true';
  });

  const handleToggleAi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setEnableAi(newValue);
    localStorage.setItem('alexandria_enable_ai', String(newValue));
  };

  // Pre-fetch family vault catalog for live search evaluation
  useEffect(() => {
    if (showSearchModal && catalog.length === 0) {
      api.get('catalog')
        .then(res => setCatalog(res.data || []))
        .catch(err => console.error('Failed to pre-fetch catalog for search:', err));
    }
  }, [showSearchModal, catalog.length]);

  /**
   * Priority Search Ranking Engine:
   * Constraint 1: Gated until query length >= 3 letters
   * Constraint 2: Ranked by Priority 1 (Title Prefix) > Priority 2 (Title Substring) > Priority 3 (Description Match)
   * Constraint 3: Bounded to Top 10 matches
   */
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();

    if (q.length < 3) {
      setSearchResults([]);
      return;
    }

    const matches: RankedResult[] = [];

    catalog.forEach(item => {
      const titleLower = (item.title || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();

      if (titleLower.startsWith(q)) {
        matches.push({ video: item, priority: 1, matchType: 'Title Prefix Match' });
      } else if (titleLower.includes(q)) {
        matches.push({ video: item, priority: 2, matchType: 'Title Substring Match' });
      } else if (descLower.includes(q)) {
        matches.push({ video: item, priority: 3, matchType: 'Description Match' });
      }
    });

    // Sort by priority rank (1 < 2 < 3), then alphabetically by title
    matches.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.video.title.localeCompare(b.video.title);
    });

    // Cap results to top 10 potential matches
    setSearchResults(matches.slice(0, 10));
  }, [searchQuery, catalog]);

  // Hide navbar in the player for full-screen cinematic immersion
  if (location.pathname === '/player') return null;

  const displayInitial = userProfile.email
    ? userProfile.email.charAt(0).toUpperCase()
    : 'U';

  const handleCopyFamilyCode = () => {
    if (userProfile.familyId) {
      navigator.clipboard.writeText(userProfile.familyId);
      alert(`Copied Family Vault Code (${userProfile.familyId}) to clipboard!`);
    }
  };

  const handleSelectSearchResult = (video: MediaItem) => {
    setShowSearchModal(false);
    setSearchQuery('');
    navigate('/details', { state: { video } });
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-40 bg-heritage-black/80 backdrop-blur-md border-b border-heritage-parchment/10 p-4 lg:p-6 flex items-center justify-between px-8 lg:px-12 transition-all">
        {/* Brand Lockup */}
        <Link to="/" className="flex items-center group">
          <img src="/logo_flat.png" alt="Alexandria+ Logo" className="h-[42px] w-auto group-hover:scale-105 transition-transform translate-x-[3px] translate-y-[1px]" />
          <h1 className="text-2xl font-black tracking-tighter text-heritage-parchment uppercase hidden sm:block -ml-[4px]">Lexandria+</h1>
        </Link>

        {/* Global Links, Search Trigger & Account Avatar */}
        <div className="flex items-center gap-6 lg:gap-8 text-sm font-black uppercase tracking-widest text-heritage-400">
            <Link to="/" className="cursor-pointer hover:text-heritage-parchment transition-colors">Home</Link>
            <Link to="/upload" className="cursor-pointer text-heritage-gold hover:text-heritage-gold/80 transition-colors flex items-center gap-1.5">
              <span>Upload</span>
            </Link>

            {/* Top-Right Search Trigger Button */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-2 text-heritage-parchment hover:text-heritage-gold transition-colors cursor-pointer rounded-full hover:bg-heritage-800/50"
              title="Search Vault Media"
            >
              <Search size={20} />
            </button>

            {/* Account Button Trigger */}
            <button
              onClick={() => setShowAccountModal(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-heritage-gold to-heritage-sunset flex items-center justify-center text-heritage-black text-sm font-black shadow-lg shadow-heritage-gold/20 hover:scale-105 transition-all cursor-pointer border border-heritage-gold/30"
              title="Account Details"
            >
              {displayInitial}
            </button>
        </div>
      </nav>

      {/* Top-Right Ranked Video Search Overlay */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-heritage-black/90 backdrop-blur-md flex items-start justify-center pt-20 px-4">
          <div className="bg-heritage-900 border border-heritage-gold/30 rounded-3xl p-6 lg:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowSearchModal(false);
                setSearchQuery('');
              }}
              className="absolute top-6 right-6 text-heritage-400 hover:text-heritage-parchment transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-heritage-gold flex items-center gap-1.5">
                <Search size={12} /> Live Vault Media Search
              </span>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search titles or descriptions (min 3 letters)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-heritage-black border border-heritage-gold/40 rounded-2xl px-5 py-4 text-heritage-parchment text-lg font-bold outline-none focus:ring-2 focus:ring-heritage-gold pr-12 shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-heritage-400 hover:text-heritage-parchment p-1"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-heritage-400 italic px-1">
                Type at least 3 letters to view live ranked matches (Prefix Match &gt; Title Substring &gt; Description).
              </p>
            </div>

            {/* Live Search Results Area */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {searchQuery.trim().length >= 3 && searchResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-heritage-400 border-b border-heritage-800 pb-2">
                    <span>Ranked Results ({searchResults.length} of 10 max)</span>
                    <span className="text-heritage-gold font-mono">Keystroke Live</span>
                  </div>

                  {searchResults.map(({ video, matchType }) => (
                    <div
                      key={video.videoId}
                      onClick={() => handleSelectSearchResult(video)}
                      className="p-3 bg-heritage-black/60 border border-heritage-800 hover:border-heritage-gold rounded-2xl flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.01] group"
                    >
                      <img
                        src={video.thumbnailUrl || "https://via.placeholder.com/150"}
                        alt={video.title}
                        className="w-20 h-14 object-cover rounded-xl border border-heritage-800 bg-heritage-900 group-hover:border-heritage-gold/50"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-bold text-heritage-parchment text-sm group-hover:text-heritage-gold transition-colors truncate">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-heritage-gold font-mono font-bold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20">
                            {matchType}
                          </span>
                          <span className="text-heritage-400">{video.genre} • {video.releaseYear}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim().length >= 3 && searchResults.length === 0 && (
                <div className="py-12 text-center text-heritage-400 italic text-sm border border-dashed border-heritage-800 rounded-2xl space-y-2">
                  <Film size={32} className="mx-auto text-heritage-800" />
                  <p>No titles or descriptions matched "{searchQuery}".</p>
                </div>
              )}

              {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                <div className="py-8 text-center text-heritage-gold text-xs font-bold bg-heritage-gold/5 border border-heritage-gold/20 rounded-2xl">
                  Please type at least {3 - searchQuery.trim().length} more letter(s) to evaluate vault matches.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-heritage-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-heritage-900 border border-heritage-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAccountModal(false)}
              className="absolute top-6 right-6 text-heritage-400 hover:text-heritage-parchment transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black text-2xl flex items-center justify-center shadow-xl">
                {displayInitial}
              </div>
              <div>
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">Family Vault Member</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20 inline-block mt-0.5">
                  Authenticated User
                </span>
              </div>
            </div>

            <div className="bg-heritage-black/70 border border-heritage-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-heritage-gold" />
                  Authenticated Email
                </span>
                <p className="text-heritage-parchment font-bold break-all select-all text-sm">
                  {userProfile.email || 'Loading...'}
                </p>
              </div>

              {userProfile.familyId && (
                <div className="pt-2 border-t border-heritage-800/80 space-y-1">
                  <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                    <Key size={12} className="text-heritage-gold" />
                    Family Vault Partition
                  </span>
                  <div className="flex items-center justify-between text-heritage-gold font-bold">
                    <span className="select-all tracking-wider text-sm">{userProfile.familyId}</span>
                    <button
                      onClick={handleCopyFamilyCode}
                      className="text-[10px] font-sans bg-heritage-gold/10 border border-heritage-gold/30 text-heritage-gold px-2 py-1 rounded hover:bg-heritage-gold/20 transition-all flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* AI Privacy & Ingestion Mode Control Toggle */}
              <div className="pt-3 border-t border-heritage-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-heritage-gold shrink-0" />
                  <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400">
                    AI Auto-Titles & Summaries
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAiDisclosure(true)}
                    className="text-heritage-gold hover:text-heritage-parchment transition-colors p-0.5"
                    title="How AI Privacy Works"
                  >
                    <HelpCircle size={14} />
                  </button>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAi}
                    onChange={handleToggleAi}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-heritage-black border border-heritage-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-heritage-parchment after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-heritage-gold"></div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAccountModal(false)}
                className="flex-1 bg-heritage-black border border-heritage-800 text-heritage-400 font-bold py-3.5 rounded-xl hover:bg-heritage-800 transition-colors uppercase text-xs tracking-wider"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  signOut();
                }}
                className="flex-1 bg-heritage-sunset/10 border border-heritage-sunset/30 text-heritage-sunset hover:bg-heritage-sunset/20 font-black py-3.5 rounded-xl transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AWS Zero AI Training Guarantee Disclosure Modal */}
      {showAiDisclosure && (
        <div className="fixed inset-0 z-50 bg-heritage-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-heritage-900 border border-heritage-gold/30 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAiDisclosure(false)}
              className="absolute top-6 right-6 text-heritage-400 hover:text-heritage-parchment transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-heritage-gold/10 border border-heritage-gold/30 rounded-xl text-heritage-gold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">AI Privacy & Safety Guarantee</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-heritage-gold">100% Zero Model Training Guarantee</span>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-heritage-400 font-medium">
              <div className="bg-heritage-black/60 border border-heritage-800 p-4 rounded-2xl space-y-2">
                <p className="font-bold text-heritage-parchment text-sm">🔒 AWS Zero-Training Guarantee</p>
                <p>
                  Amazon Web Services (AWS Bedrock) <strong>100% guarantees</strong> that your personal family photos, videos, and keyframe thumbnails are <strong>never used to train public AI models</strong>. Your family memories remain 100% private to your vault.
                </p>
              </div>

              <div className="bg-heritage-black/60 border border-heritage-800 p-4 rounded-2xl space-y-2">
                <p className="font-bold text-heritage-gold text-sm">✨ What AI Mode Does (When Enabled)</p>
                <p>
                  When enabled, a single video keyframe thumbnail is analyzed by <strong>Amazon Bedrock Claude Vision</strong> to automatically draft a suggested title, a 3-sentence event summary, tags, and a Heritage Genre for your review.
                </p>
              </div>

              <div className="bg-heritage-black/60 border border-heritage-800 p-4 rounded-2xl space-y-2">
                <p className="font-bold text-heritage-parchment text-sm">🛡️ Manual Privacy Mode (Default - When Disabled)</p>
                <p>
                  When disabled, your media is uploaded with <strong>100% manual privacy</strong>. No images leave your vault or enter AI models, saving cloud compute and making your video immediately ready for manual review.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAiDisclosure(false)}
              className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-3.5 rounded-xl uppercase tracking-widest text-xs shadow-xl"
            >
              Understood & Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
