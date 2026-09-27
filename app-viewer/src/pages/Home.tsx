/**
 * ============================================================================
 * Home Catalog View Page (The Scroll)
 * ============================================================================
 * Enterprise Architecture Strategy: Netflix-Style Heritage Category Rows.
 * Fetches authenticated catalog media items from Scribe API Gateway,
 * dynamically grouping published videos into horizontal scrolling category rows
 * by genres configured in the DynamoDB registry.
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
  const [genres, setGenres] = useState<string[]>([]);
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

    const fetchGenres = async () => {
      try {
        const res = await api.get('genres');
        if (!Array.isArray(res.data)) throw new Error('Genre registry returned an invalid response.');
        setGenres(res.data
          .map((genre: { genreName?: string }) => genre.genreName?.trim())
          .filter((genre: string | undefined): genre is string => Boolean(genre)));
      } catch (err) {
        console.error('Failed to fetch genres:', err);
      }
    };
    fetchGenres();
  }, []);

  const featured = videos[0];

  // Only show categories present in the DynamoDB genre registry.
  const videosByGenre = videos.reduce((acc, video) => {
    if (genres.includes(video.genre)) {
      if (!acc[video.genre]) acc[video.genre] = [];
      acc[video.genre].push(video);
    }
    return acc;
  }, {} as Record<string, MediaItem[]>);

  const genresList = genres.filter(genre => videosByGenre[genre]?.length);

  return (
    <div className="pb-20">
      {/* Featured Selection Hero Section */}
      {featured && (
        <section className="relative min-h-[85vh] w-full overflow-hidden pt-24 lg:pt-28">
          {/* Hero Thumbnail Backdrop positioned cleanly under floating header banner */}
          <div className="absolute inset-0 top-20 lg:top-24 z-0">
             <img
               src={featured.thumbnailUrl}
               alt={featured.title}
               className="w-full h-full object-cover object-top scale-105 blur-[2px] opacity-40"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-heritage-black via-heritage-black/40 to-transparent" />
             <div className="absolute inset-0 bg-gradient-to-r from-heritage-black via-transparent to-transparent" />
          </div>

          <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-12 max-w-4xl space-y-6 pt-8">
            <span className="inline-block bg-heritage-gold/20 text-heritage-gold text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-heritage-gold/30 w-fit">
               Featured Selection
            </span>
            <h2 className="text-5xl lg:text-7xl xl:text-8xl font-black text-heritage-parchment leading-none tracking-tight drop-shadow-2xl">
              {featured.title}
            </h2>
            <p className="text-lg lg:text-xl text-heritage-400 max-w-2xl font-medium leading-relaxed">
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

      {/* Netflix-Style Heritage Category Rows Section */}
      <section className="px-8 lg:px-12 mt-12 space-y-12">
        {genresList.map(genreName => (
          <div key={genreName} className="space-y-4">
            <h3 className="text-xl lg:text-2xl font-black text-heritage-parchment flex items-center gap-3 tracking-tight">
              <span className="w-1.5 h-6 bg-heritage-gold rounded-full" />
              {genreName}
            </h3>

            {/* Horizontal Scrollable Category Row */}
            <div className="flex gap-6 overflow-x-auto pb-4 pt-2 no-scrollbar scroll-smooth">
              {videosByGenre[genreName].map(video => (
                <div
                  key={video.videoId}
                  onClick={() => navigate('/details', { state: { video } })}
                  className="group relative flex-none w-72 lg:w-80 aspect-video bg-heritage-900 rounded-2xl overflow-hidden cursor-pointer border border-heritage-800 hover:border-heritage-gold/50 transition-all transform hover:scale-105 shadow-2xl"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-heritage-black/95 via-heritage-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h4 className="font-bold text-heritage-parchment text-base leading-snug line-clamp-2">{video.title}</h4>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[10px] text-heritage-gold font-black uppercase tracking-wider bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20">{video.genre}</span>
                       <span className="text-xs text-heritage-400/80 font-mono">{video.releaseYear}</span>
                    </div>
                  </div>
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-heritage-gold/20 backdrop-blur-md rounded-full flex items-center justify-center border border-heritage-gold/40 transform scale-0 group-hover:scale-100 transition-transform duration-300 shadow-xl">
                          <Play fill="white" size={24} className="text-heritage-parchment ml-1" />
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="space-y-8">
            {Array.from({length: 2}).map((_, idx) => (
              <div key={idx} className="space-y-4">
                <div className="w-48 h-6 bg-heritage-900 animate-pulse rounded-md" />
                <div className="flex gap-6 overflow-hidden">
                  {Array.from({length: 4}).map((_, i) => (
                    <div key={i} className="flex-none w-72 aspect-video bg-heritage-900 animate-pulse rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="py-20 text-center text-heritage-400 italic">
             The library is currently empty. Visit Demetrius to add your first digital scroll.
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
