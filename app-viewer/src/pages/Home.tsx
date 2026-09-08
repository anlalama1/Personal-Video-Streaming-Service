import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Play, Info, Library } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface MediaItem {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  thumbnailUrl: string;
  videoUrl: string;
}

const Home = () => {
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}catalog`, {
          headers: { 'x-tenant-id': 'GLOBAL' }
        });
        setVideos(res.data);
      } catch (err) {
        console.error('Failed to fetch catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const featured = videos[0];

  return (
    <div className="pb-20">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent p-6 flex items-center justify-between px-12">
        <div className="flex items-center gap-2">
          <Library className="text-blue-500 w-8 h-8" />
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">Alexandria+</h1>
        </div>
        <div className="flex items-center gap-8 text-sm font-bold text-slate-300">
            <span className="cursor-pointer hover:text-white transition-colors">Home</span>
            <span className="cursor-pointer hover:text-white transition-colors">Movies</span>
            <span className="cursor-pointer hover:text-white transition-colors">Music</span>
            <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">AL</span>
        </div>
      </nav>

      {/* Hero Section */}
      {featured && (
        <section className="relative h-[80vh] w-full overflow-hidden">
          <div className="absolute inset-0 z-0">
             <img
               src={featured.thumbnailUrl}
               alt={featured.title}
               className="w-full h-full object-cover scale-105 blur-[2px] opacity-40"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
             <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-center px-12 max-w-4xl space-y-6">
            <span className="inline-block bg-blue-600/20 text-blue-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/30 w-fit">
               Featured Selection
            </span>
            <h2 className="text-6xl lg:text-8xl font-black text-white leading-none tracking-tight drop-shadow-2xl">
              {featured.title}
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl font-medium leading-relaxed">
              Experience the digital resurrection of family heritage. A professionally preserved digital scroll, now streaming in high fidelity across your entire ecosystem.
            </p>

            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => navigate('/player', { state: { video: featured } })}
                className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-black hover:bg-blue-500 hover:text-white transition-all transform hover:scale-105 shadow-xl"
              >
                <Play fill="currentColor" size={24} />
                <span>Play Now</span>
              </button>
              <button className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700">
                <Info size={24} />
                <span>More Info</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Catalog Grid */}
      <section className="px-12 mt-12 space-y-12">
        <div>
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
             <span className="w-1 h-8 bg-blue-500 rounded-full" />
             Your Digital Library
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {videos.map(video => (
              <div
                key={video.videoId}
                onClick={() => navigate('/player', { state: { video } })}
                className="group relative aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer border border-slate-800 hover:border-blue-500/50 transition-all transform hover:scale-105 shadow-2xl"
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <h4 className="font-bold text-white text-lg leading-tight">{video.title}</h4>
                  <div className="flex items-center justify-between mt-2">
                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{video.genre}</span>
                     <span className="text-xs text-slate-500">{video.releaseYear}</span>
                  </div>
                </div>
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <Play fill="white" size={24} className="text-white ml-1" />
                    </div>
                </div>
              </div>
            ))}

            {loading && Array.from({length: 5}).map((_, i) => (
              <div key={i} className="aspect-video bg-slate-900 animate-pulse rounded-xl" />
            ))}
          </div>

          {!loading && videos.length === 0 && (
            <div className="py-20 text-center text-slate-500 italic">
               The library is currently empty. Visit Demetrius to add your first digital scroll.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
