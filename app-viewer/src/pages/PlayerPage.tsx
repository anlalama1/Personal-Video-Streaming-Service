import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import shaka from 'shaka-player';
import { ArrowLeft, Settings, Maximize } from 'lucide-react';

const PlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { video } = location.state || {};

  useEffect(() => {
    if (!video || !videoRef.current) return;

    // Initialize Shaka Player
    const player = new shaka.Player(videoRef.current);

    // Install polyfills
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      console.error('Browser not supported for Shaka Player');
      return;
    }

    const initPlayer = async () => {
      try {
        await player.load(video.videoUrl);
        console.log('Video loaded successfully into Shaka');
      } catch (err) {
        console.error('Shaka Player Error:', err);
      }
    };

    initPlayer();

    return () => {
      player.destroy();
    };
  }, [video]);

  if (!video) return <div className="p-20 text-center">Video metadata missing.</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden group">
      {/* Custom Control Overlay (Top) */}
      <div className="absolute top-0 left-0 w-full p-8 z-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-3 text-white hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={28} />
          <span className="text-xl font-bold tracking-tight">{video.title}</span>
        </button>

        <div className="flex items-center gap-6 text-slate-300">
           <Settings className="cursor-pointer hover:text-white" size={24} />
           <Maximize className="cursor-pointer hover:text-white" size={24} />
        </div>
      </div>

      {/* The Video Element */}
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full max-h-screen outline-none"
          autoPlay
          controls
        />
      </div>

      {/* Bottom Subtle Overlay */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

export default PlayerPage;
