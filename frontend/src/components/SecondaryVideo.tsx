import { useEffect, useRef, useState } from 'react';

interface Props {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  label?: string;        // e.g. "ANGLE 1"
  onClick?: () => void;  // swap local vers la vue principale
  isSelected?: boolean;  // highlight si c'est le flux affiché en principal local
}

export default function SecondaryVideo({ videoId, isPlaying, currentTime, label, onClick, isSelected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize YouTube IFrame player
  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) { }
      }
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          mute: 1,
          rel: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => setIsReady(true),
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const t = setTimeout(initPlayer, 1000);
      return () => clearTimeout(t);
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) { }
      }
    };
  }, [videoId]);

  // Sync play / pause
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    if (isPlaying) playerRef.current.playVideo?.();
    else playerRef.current.pauseVideo?.();
  }, [isPlaying, isReady]);

  // Re-sync immédiat si le temps change (ex: saut dans la timeline, même en pause)
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    const t = playerRef.current.getCurrentTime?.();
    if (t !== undefined && Math.abs(t - currentTime) > 1.5) {
      playerRef.current.seekTo(currentTime, true);
    }
  }, [currentTime, isReady]);

  // Re-sync continu en arrière-plan pour éviter la dérive pendant la lecture
  useEffect(() => {
    if (!isReady || !playerRef.current || !isPlaying) return;
    const interval = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.();
      if (t !== undefined && Math.abs(t - currentTime) > 3) {
        playerRef.current.seekTo(currentTime, true);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentTime, isPlaying, isReady]);

  return (
    // 16:9 aspect ratio wrapper using padding-top trick
    <div
      className={`relative w-full rounded overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer' : ''
        } ${isSelected
          ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900'
          : 'ring-1 ring-gray-700'
        }`}
      style={{ paddingTop: '56.25%' }}
      onClick={onClick}
      title={onClick ? 'Cliquez pour afficher en vidéo principale (local)' : undefined}
    >
      {/* YouTube player fills the padded box */}
      <div
        ref={containerRef}
        className="absolute inset-0 bg-black pointer-events-none"
      />
      {/* Label badge */}
      {label && (
        <div className="absolute top-1 left-1 z-10 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest select-none">
          {label}
        </div>
      )}
      {/* "Selected" badge */}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 bg-blue-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest select-none">
          Vue locale
        </div>
      )}
      {/* Loading indicator */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
        </div>
      )}
    </div>
  );
}
