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
    <div className="relative min-h-screen bg-heritage-black overflow-hidden">
      {/* Background Cinematic Backdrop */}
      <div className="absolute inset-0 z-0">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover opacity-30 blur-[4px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-heritage-black via-heritage-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-heritage-black via-transparent to-transparent" />
      </div>

      {/* Main Content Pane */}
      <main className="relative z-10 container mx-auto px-8 lg:px-12 pt-32 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

        {/* Left Column: Metadata & Actions */}
        <div className="lg:col-span-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <span className="bg-heritage-gold/20 text-heritage-gold text-[10px] font-black px-2.5 py-1 rounded border border-heritage-gold/30 uppercase tracking-widest">
                  {video.genre}
               </span>
               <div className="flex items-center gap-1.5 text-heritage-400 text-xs font-bold">
                  <Calendar size={14} />
                  {video.releaseYear}
               </div>
            </div>

            <h1 className="text-6xl lg:text-8xl font-black text-heritage-parchment leading-tight tracking-tighter drop-shadow-2xl">
              {video.title}
            </h1>
          </div>

          <div className="max-w-2xl">
             <p className="text-lg lg:text-xl text-heritage-400 leading-relaxed font-medium">
               {video.description || "No description available for this digital scroll. This asset has been professionally preserved and is ready for high-fidelity streaming across the Alexandria+ ecosystem."}
             </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-6 pt-6">
            <button
              onClick={() => navigate('/player', { state: { video } })}
              className="flex items-center gap-3 bg-heritage-gold text-heritage-black px-10 py-5 rounded-2xl font-black hover:bg-heritage-gold/90 transition-all transform hover:scale-105 shadow-2xl active:scale-95"
            >
              <Play fill="currentColor" size={28} />
              <span className="text-lg uppercase tracking-tighter">Play Selection</span>
            </button>
          </div>

        </div>

        {/* Right Column: Poster / Visual Hook (Optional but nice) */}
        <div className="hidden lg:block lg:col-span-4">
           <div className="aspect-[2/3] w-full bg-heritage-900 rounded-3xl overflow-hidden border border-heritage-parchment/10 shadow-2xl group relative font-mono">
              <img
                src={video.thumbnailUrl}
                alt="Poster view"
                className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-heritage-black via-transparent to-transparent" />
           </div>
        </div>
      </main>
    </div>
  );
};

export default MediaDetails;
