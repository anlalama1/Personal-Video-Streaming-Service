/**
 * ============================================================================
 * Shaka Player Web Video Player Page
 * ============================================================================
 * Enterprise Architecture Strategy: HLS / Adaptive Bitrate (ABR) Engine.
 * Utilizes Google Shaka Player to decode multi-bitrate HLS streams (.m3u8),
 * handling dynamic track switching and browser playback polyfills.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import shaka from 'shaka-player';
import { ArrowLeft, Settings, Maximize } from 'lucide-react';
import api from '../api';

const PlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const { video } = location.state || {};

  /**
   * Initializes Shaka Player instance and attaches HLS media source.
   */
  useEffect(() => {
    if (!video || !videoRef.current) return;

    let player: InstanceType<typeof shaka.Player> | null = null;
    let cookieDomain = new URL(video.videoUrl).hostname;
    let cookiePath = '/hls';
    let cancelled = false;

    // Install browser polyfills for MSE / EME compatibility
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      console.error('Browser not supported for Shaka Player');
      return;
    }

    const initPlayer = async () => {
      try {
        setPlaybackError(null);
        const session = await api.post('play/session', {
          videoId: video.videoId,
          familyId: video.familyId,
          tenantId: video.tenantId
        });
        const { signedCookies, expiresAt, playbackUrl } = session.data;
        if (cancelled) return;
        cookieDomain = session.data.cdnDomain;
        if (!playbackUrl) throw new Error('Playback authorization returned no media URL.');
        cookiePath = playbackUrl.includes('/media/') ? '/media' : '/hls';
        const cookieNames = ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'];
        if (!cookieDomain || !cookieNames.every(name => signedCookies?.[name])) {
          throw new Error('Playback authorization returned incomplete signed cookies.');
        }
        const expiry = expiresAt ? `; Expires=${new Date(expiresAt * 1000).toUTCString()}` : '';
        cookieNames.forEach(name => {
          document.cookie = `${name}=${signedCookies[name]}; Domain=${cookieDomain}; Path=${cookiePath}; Secure; SameSite=None${expiry}`;
        });
        if (playbackUrl.toLowerCase().includes('.m3u8')) {
          player = new shaka.Player(videoRef.current!);
          player.getNetworkingEngine()?.registerRequestFilter((
            _type: number,
            request: { allowCrossSiteCredentials?: boolean }
          ) => {
            request.allowCrossSiteCredentials = true;
          });
          await player.load(playbackUrl);
        } else {
          videoRef.current!.crossOrigin = 'use-credentials';
          videoRef.current!.src = playbackUrl;
          videoRef.current!.load();
        }
        console.log('Video loaded successfully into Shaka');
      } catch (err) {
        console.error('Shaka Player Error:', err);
        setPlaybackError('Unable to authorize or load this video. Check your vault access and try again.');
      }
    };

    initPlayer();

    return () => {
      cancelled = true;
      // Destroy Shaka Player instance on component unmount
      if (player) void player.destroy();
      ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'].forEach(name => {
        document.cookie = `${name}=; Domain=${cookieDomain}; Path=${cookiePath}; Secure; SameSite=None; Max-Age=0`;
      });
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
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
      {playbackError && (
        <div role="alert" className="absolute inset-x-6 bottom-24 z-50 rounded-xl bg-black/80 p-4 text-center text-heritage-parchment">
          {playbackError}
        </div>
      )}

      {/* Bottom Visual Gradient Overlay */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

export default PlayerPage;
