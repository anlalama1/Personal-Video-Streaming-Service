import { useLocation, useNavigate } from 'react-router-dom';
import { Play, ArrowLeft, Clock, Calendar } from 'lucide-react';

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

const MediaDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { video } = location.state as { video: MediaItem } || {};

  if (!video) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400">Media context lost.</p>
        <button onClick={() => navigate('/')} className="text-blue-400 hover:underline">Return Home</button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden">
      {/* Background Cinematic Backdrop */}
      <div className="absolute inset-0 z-0">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover opacity-30 blur-[4px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 p-8">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:border-white/20 transition-all">
            <ArrowLeft size={20} />
          </div>
          <span className="font-bold text-sm tracking-widest uppercase">Back to Library</span>
        </button>
      </nav>

      {/* Main Content Pane */}
      <main className="relative z-10 container mx-auto px-8 lg:px-12 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

        {/* Left Column: Metadata & Actions */}
        <div className="lg:col-span-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <span className="bg-blue-600/20 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded border border-blue-500/30 uppercase tracking-widest">
                  {video.genre}
               </span>
               <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                  <Calendar size={14} />
                  {video.releaseYear}
               </div>
            </div>

            <h1 className="text-6xl lg:text-8xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl">
              {video.title}
            </h1>
          </div>

          <div className="max-w-2xl">
             <p className="text-lg lg:text-xl text-slate-300 leading-relaxed font-medium">
               {video.description || "No description available for this digital scroll. This asset has been professionally preserved and is ready for high-fidelity streaming across the Alexandria+ ecosystem."}
             </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-6 pt-6">
            <button
              onClick={() => navigate('/player', { state: { video } })}
              className="flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black hover:bg-blue-500 hover:text-white transition-all transform hover:scale-105 shadow-2xl active:scale-95"
            >
              <Play fill="currentColor" size={28} />
              <span className="text-lg uppercase tracking-tighter">Play Selection</span>
            </button>
          </div>

        </div>

        {/* Right Column: Poster / Visual Hook (Optional but nice) */}
        <div className="hidden lg:block lg:col-span-4">
           <div className="aspect-[2/3] w-full bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl group relative">
              <img
                src={video.thumbnailUrl}
                alt="Poster view"
                className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
           </div>
        </div>
      </main>
    </div>
  );
};

export default MediaDetails;
