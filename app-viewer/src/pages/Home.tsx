/**
 * ============================================================================
 * Home Catalog View Page (The Scroll)
 * ============================================================================
 * Enterprise Architecture Strategy: Media Grid & Hero Section.
 * Fetches authenticated catalog media items from Scribe API Gateway,
 * rendering featured hero content and responsive catalog thumbnail grids.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Info } from 'lucide-react';
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

const Home = () => {
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /**
   * Fetches published catalog items for the authenticated user's family vault.
   */
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await api.get('catalog');
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
      {/* Featured Selection Hero Section */}
      {featured && (
        <section className="relative h-[80vh] w-full overflow-hidden pt-20 lg:pt-0">
          <div className="absolute inset-0 z-0">
             <img
               src={featured.thumbnailUrl}
               alt={featured.title}
               className="w-full h-full object-cover scale-105 blur-[2px] opacity-40"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-heritage-black via-heritage-black/40 to-transparent" />
             <div className="absolute inset-0 bg-gradient-to-r from-heritage-black via-transparent to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-center px-12 max-w-4xl space-y-6">
            <span className="inline-block bg-heritage-gold/20 text-heritage-gold text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-heritage-gold/30 w-fit">
               Featured Selection
            </span>
            <h2 className="text-6xl lg:text-8xl font-black text-heritage-parchment leading-none tracking-tight drop-shadow-2xl">
              {featured.title}
            </h2>
            <p className="text-xl text-heritage-400 max-w-2xl font-medium leading-relaxed">
              Experience the digital resurrection of family heritage. A professionally preserved digital scroll, now streaming in high fidelity across your entire ecosystem.
            </p>

            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => navigate('/player', { state: { video: featured } })}
                className="flex items-center gap-3 bg-heritage-gold text-heritage-black px-8 py-4 rounded-xl font-black hover:bg-heritage-gold/90 transition-all transform hover:scale-105 shadow-xl"
              >
                <Play fill="currentColor" size={24} />
                <span>Play Now</span>
              </button>
              <button
                onClick={() => navigate('/details', { state: { video: featured } })}
                className="flex items-center gap-3 bg-heritage-800/80 backdrop-blur-md text-heritage-parchment px-8 py-4 rounded-xl font-bold hover:bg-heritage-800 transition-all border border-heritage-800"
              >
                <Info size={24} />
                <span>More Info</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Catalog Grid Section */}
      <section className="px-12 mt-12 space-y-12">
        <div>
          <h3 className="text-2xl font-bold text-heritage-parchment mb-6 flex items-center gap-3">
             <span className="w-1 h-8 bg-heritage-gold rounded-full" />
             Your Digital Library
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {videos.map(video => (
              <div
                key={video.videoId}
                onClick={() => navigate('/details', { state: { video } })}
                className="group relative aspect-video bg-heritage-900 rounded-xl overflow-hidden cursor-pointer border border-heritage-800 hover:border-heritage-gold/50 transition-all transform hover:scale-105 shadow-2xl"
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-heritage-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <h4 className="font-bold text-heritage-parchment text-lg leading-tight">{video.title}</h4>
                  <div className="flex items-center justify-between mt-2">
                     <span className="text-xs text-heritage-400 font-bold uppercase tracking-wider">{video.genre}</span>
                     <span className="text-xs text-heritage-400/60 font-mono">{video.releaseYear}</span>
                  </div>
                </div>
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-heritage-gold/20 backdrop-blur-md rounded-full flex items-center justify-center border border-heritage-gold/30 transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <Play fill="white" size={24} className="text-heritage-parchment ml-1" />
                    </div>
                </div>
              </div>
            ))}

            {loading && Array.from({length: 5}).map((_, i) => (
              <div key={i} className="aspect-video bg-heritage-900 animate-pulse rounded-xl" />
            ))}
          </div>

          {!loading && videos.length === 0 && (
            <div className="py-20 text-center text-heritage-400 italic">
               The library is currently empty. Visit Demetrius to add your first digital scroll.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
