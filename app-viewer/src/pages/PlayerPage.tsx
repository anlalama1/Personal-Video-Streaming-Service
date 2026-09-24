/**
 * ============================================================================
 * Shaka Player Web Video Player Page
 * ============================================================================
 * Enterprise Architecture Strategy: HLS / Adaptive Bitrate (ABR) Engine.
 * Utilizes Google Shaka Player to decode multi-bitrate HLS streams (.m3u8),
 * handling dynamic track switching and browser playback polyfills.
 */

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

  /**
   * Initializes Shaka Player instance and attaches HLS media source.
   */
  useEffect(() => {
    if (!video || !videoRef.current) return;

    // Initialize Shaka Player instance
    const player = new shaka.Player(videoRef.current);

    // Install browser polyfills for MSE / EME compatibility
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
      // Destroy Shaka Player instance on component unmount
      player.destroy();
    };
  }, [video]);

  if (!video) return <div className="p-20 text-center">Video metadata missing.</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden group">
      {/* Custom Control Overlay (Top Header) */}
      <div className="absolute top-0 left-0 w-full p-8 z-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-heritage-black/80 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-3 text-heritage-parchment hover:text-heritage-gold transition-colors"
        >
          <ArrowLeft size={28} />
          <span className="text-xl font-bold tracking-tight">{video.title}</span>
        </button>

        <div className="flex items-center gap-6 text-heritage-400">
           <Settings className="cursor-pointer hover:text-heritage-parchment" size={24} />
           <Maximize className="cursor-pointer hover:text-heritage-parchment" size={24} />
        </div>
      </div>

      {/* Native Video Element attached to Shaka Player */}
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full max-h-screen outline-none"
          autoPlay
          controls
        />
      </div>

      {/* Bottom Visual Gradient Overlay */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

export default PlayerPage;
