import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoItem {
  id: string;
  title: string;
}

//Callbacks pour synchroniser l'état du lecteur avec d'autres composants
interface SyncCallbacks {
  onPlayPause?: (isPlaying: boolean, timestamp: number) => void;
  onSeek?: (timestamp: number) => void;
  onVideoChange?: (videoId: string) => void;
}

interface UseYouTubePlayerOptions {
  syncCallbacks?: SyncCallbacks;
}

export function useYouTubePlayer(options: UseYouTubePlayerOptions = {}) {
  const { syncCallbacks } = options;

  //refs pour le player youtube
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playlistRef = useRef<VideoItem[]>([]);
  const currentVideoIndexRef = useRef(0);
  const isApplyingSyncRef = useRef(false);

  //états du lecteur
  const [isReady, setIsReady] = useState(false);
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);

  //synchroniser les refs avec les états
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentVideoIndexRef.current = currentVideoIndex;
  }, [currentVideoIndex]);

  //charger une vidéo par son index
  const loadVideo = (index: number) => {
    if (index < 0 || index >= playlist.length || !playerRef.current || !isReady) return;
    setCurrentVideoIndex(index);
    playerRef.current.loadVideoById(playlist[index].id);

    //callback si fourni
    if (syncCallbacks?.onVideoChange && !isApplyingSyncRef.current) {
      syncCallbacks.onVideoChange(playlist[index].id);
    }
  };

  //initialisation du lecteur youtube
  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;
      
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          disabkekb : 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsReady(true);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
            //passer à la vidéo suivante si terminée
            if (event.data === window.YT.PlayerState.ENDED) {
              const next = currentVideoIndexRef.current + 1;
              if (next < playlistRef.current.length && playerRef.current) {
                playerRef.current.loadVideoById(playlistRef.current[next].id);
                playerRef.current.playVideo();
                setCurrentVideoIndex(next);
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, []);

  //mise à jour de la barre de progression toutes les 500ms
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        setDuration(dur);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [isReady]);

  //charger la première vidéo quand la playlist n'est plus vide
  useEffect(() => {
    if (isReady && playlist.length > 0 && currentVideoIndex === 0 && playerRef.current) {
      const videoData = playerRef.current.getVideoData?.();
      if (!videoData || !videoData.video_id) {
        loadVideo(0);
      }
    }
  }, [isReady, playlist.length, currentVideoIndex]);


  //gestion du plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  //play/pause de la vidéo
  const playPause = () => {
    if (!playerRef.current || !isReady) return;
    const willPlay = !isPlaying;

    if (willPlay) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }

    // callback si fourni ET pas en mode sync
    if (syncCallbacks?.onPlayPause && !isApplyingSyncRef.current) {
      const currentTimestamp = playerRef.current.getCurrentTime();
      syncCallbacks.onPlayPause(willPlay, currentTimestamp);
    }
  };

  //déplacer la position de lecture
  const seek = (percentage: number) => {
    if (!playerRef.current || !duration || !isReady) return;
    const seekTo = duration * (percentage / 100);
    playerRef.current.seekTo(seekTo, true);

    //callback si fourni ET pas en mode sync
    if (syncCallbacks?.onSeek && !isApplyingSyncRef.current) {
      syncCallbacks.onSeek(seekTo);
    }
  };

  //changer le volume
  const setVolumeLevel = (vol: number) => {
    if (!playerRef.current || !isReady) return;
    playerRef.current.setVolume(vol);
    setVolume(vol);
  };

  //activer/désactiver le plein écran
  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    const iframe = playerRef.current.getIframe?.();
    if (!iframe) return;
    
    if (!document.fullscreenElement) {
      if (iframe.requestFullscreen) iframe.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  //extraire l'id youtube d'une url
  const extractVideoID = (url: string): string | null => {
    try {
      const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|embed|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = url.match(regex);
      if (match && match[1]) return match[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
      return null;
    } catch (err) {
      console.error('Erreur lors de l\'extraction de l\'ID vidéo', err);
      return null;
    }
  };

  //ajouter une vidéo à la playlist (version simplifiée - utilise l'id comme titre)
  const addVideo = (url: string) => {
    const videoID = extractVideoID(url);
    if (!videoID) {
      alert('Veuillez entrez une URL valide ou une vidéo YouTube compatible.');
      return;
    }

    //vérifier les doublons
    if (playlist.some(v => v.id === videoID)) {
      alert('Cette vidéo est déjà dans ajoutée.');
      return;
    }
    
    setPlaylist((prev) => {
      //numéro de la vidéo dans la playlist
      const videoNumber = prev.length + 1;
      const newVideo: VideoItem = { id: videoID, title: `Vidéo ${videoNumber}: ${videoID}` };
      const updated = [...prev, newVideo];
      
      //charger la première vidéo automatiquement
      if (prev.length === 0 && isReady && playerRef.current) {
        setTimeout(() => {
          playerRef.current.loadVideoById(videoID);
        }, 100);
      }
      
      return updated;
    });
  };

  //fonction ajoute une vidéo à la playlist sans déclencher de callbacks de synchronisation
  const addVideoSilently = (videoID: string): number => {
    //vérifier si la vidéo est déjà présente dans la playlist via la ref
    const existingIndex = playlistRef.current.findIndex(v => v.id === videoID);
    if (existingIndex !== -1) {
      return existingIndex; //vidéo trouvée, retourner son index
    }
    const videoNumber = playlistRef.current.length + 1; //crée la vidéo + un "title" pour qu'il identifie
    const newVideo: VideoItem = { id: videoID, title: `Vidéo ${videoNumber}: ${videoID}` };
    const updatedPlaylist = [...playlistRef.current, newVideo];//copie la playlist actuelle et ajouter la nouvelle vidéo
    setPlaylist(updatedPlaylist);
    //update la playlist local pour y accéder directement
    playlistRef.current = updatedPlaylist;
    console.log(`Vidéo auto-ajoutée depuis sync: ${videoID}`);
    return updatedPlaylist.length - 1; //retourner le nouvel index
  };
  const applySyncState = (etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => {
    if (!playerRef.current || !isReady) {
      console.warn('Player pas prêt');
      return;
    }
    console.log('Application sync_state:', { etat, timestamp, videoId });
    isApplyingSyncRef.current = true; //évite une boucle infini sur les callback vers le serv
    //autre callback seront déactiver/non envoyer vers le serv
    try {
      //changer de vidéo si nécessaire
      if (videoId) {
        const currentVideoData = playerRef.current.getVideoData?.();
        const currentLoadedVideoId = currentVideoData?.video_id;
        //si la vidéo demandée est différente de celle actuellement chargée
        if (currentLoadedVideoId !== videoId) {
          //chercher dans la playlist
          let index = playlistRef.current.findIndex((v) => v.id === videoId);
          //si pas trouvé, l'ajouter automatiquement
          if (index === -1) {
            console.log(`Vidéo ${videoId} pas dans la playlist, ajout automatique...`);
            index = addVideoSilently(videoId);
          }
          //charger la vidéo
          setCurrentVideoIndex(index);
          playerRef.current.loadVideoById(videoId);
          //attendre un peu que la vidéo se charge avant de seek de 500ms
          setTimeout(() => {
            if (playerRef.current) {
              playerRef.current.seekTo(timestamp, true);
              if (etat === 'PLAY') {
                playerRef.current.playVideo();
                setIsPlaying(true);
              } else {
                playerRef.current.pauseVideo();
                setIsPlaying(false);
              }
            }
          }, 500);
          return;
        }
      }
      //synchroniser le timestamp
      playerRef.current.seekTo(timestamp, true);
      //appliquer l'état play/pause
      if (etat === 'PLAY') {
        playerRef.current.playVideo();
        setIsPlaying(true);
      } else {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
    } finally {
      setTimeout(() => {      //les callbacks sont réactiver  avec un timer le temps que youtube fait ca tâche sans problème
        isApplyingSyncRef.current = false;
      }, 500);
    }
  };

  return {
    containerRef,
    playlist,
    currentVideoIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isFullscreen,
    isReady,
    playPause,
    seek,
    setVolumeLevel,
    toggleFullscreen,
    loadVideo,
    addVideo,
    applySyncState,
    seekPercentage: duration > 0 ? (currentTime / duration) * 100 : 0,
  };
}
