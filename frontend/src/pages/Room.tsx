import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useYouTubePlayer } from '../services/useYouTubePlayer';
import { useSocket, type AnnotationPayload } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import SecondaryVideo from '../components/SecondaryVideo';
import AnnotationOverlay, { type AnnotationTool } from '../components/AnnotationOverlay';

interface StreamElement {
  id_element_playlist: number;
  fournisseur: string;
  video_id: string;
  position: number;
  etat_lecture: string;
  horodatage_sec: number;
}

interface LocationState {   //variables qui ne peuvent pas etre "modifier" directement dans l'url
  salonName?: string;
  userPseudo?: string;
  codePartage?: string;
  isHost?: boolean;
}

interface ChatMessage {
  author: string;
  text: string;
  timestamp: Date;
}

interface Participant {
  pseudo: string;
  role: 'HOST' | 'MEMBER' | string;
}

export default function Room() {
  //récupère les paramètres des states venant du formulaire de CreationApp
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const { user } = useAuth();
  const [roomName] = useState(state?.salonName || 'undefined salon')
  const [userPseudo] = useState(state?.userPseudo || user?.pseudo || '');
  const [codePartage] = useState(code || state?.codePartage || '');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [blockClicks] = useState(true); //bloque les click sur le vidéo container

  // BUG FIX: état du rôle de l'utilisateur, initialisé depuis isHost du state de navigation
  // Peut être mis à jour si le serveur envoie le rôle via sync_state
  const [userRole, setUserRole] = useState<'HOST' | 'MEMBER'>(
    state?.isHost ? 'HOST' : 'MEMBER'
  );

  //les etats des videos pour le multi-stream
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [mainVideoId, setMainVideoId] = useState<string>('');
  const [mainFournisseur, setMainFournisseur] = useState<string>('YOUTUBE');

  // modes (standard ou sport)
  const [roomMode, setRoomMode] = useState<'STANDARD' | 'SPORTS_ANALYSIS'>('STANDARD');
  const [annotations, setAnnotations] = useState<AnnotationPayload[]>([]);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('draw');
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [textInput, setTextInput] = useState('');

  //les etats des mini-flux
  const [secondarySlots, setSecondarySlots] = useState<(string | null)[]>([null, null, null]);
  const secondarySlotsRef = useRef(secondarySlots);
  useEffect(() => { secondarySlotsRef.current = secondarySlots; }, [secondarySlots]);

  //echange local, quel mini-flux est affiché dans le player principal (null = vidéo du serveur)
  const [localMainVideoId, setLocalMainVideoId] = useState<string | null>(null);
  const [localMainSlotIdx, setLocalMainSlotIdx] = useState<number | null>(null);

  // Réf pour addAnnotation (évite les boucles de dépendances)
  const addAnnotationRef = useRef<any>(null);

  //broadcast des slots secondaires pour que les autres utilisateurs voient les memes videos
  const broadcastSecondarySlots = useCallback((slots: (string | null)[]) => {
    if (addAnnotationRef.current) {
      addAnnotationRef.current({
        id_angle: null,
        timestamp_video: 0,
        type: 'SYNC_SECONDARY',
        payload: slots
      });
    }
  }, []);

  //valeurs pour le chat et le salon
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);  //ref pour auto scroll vers le bas le message container

  //gestion du lecteur youtube + chat
  const applySyncStateRef = useRef<((etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => void) | null>(null);
  const sendUpdateRef = useRef<((etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => void) | null>(null);
  const sendMessageRef = useRef<((contenu: string) => void) | null>(null);

  useEffect(() => {   //si aucun code du salon valide n'est récupérable alors retourne une erreur puis kick vers Creation
    if (!codePartage) {
      console.error('Code de salon introuvable, redirection vers creation de salon');
      navigate('/creation');
    }
    if (userPseudo == '') { //meme chose s'il n'a pas de pseudo non defini
      console.error('Pseudo non identifiable, redirection vers creation de salon');
      navigate('/creation');
    }
  }, [codePartage, userPseudo, navigate]);

  //callbacks pour recevoir des messages
  const onChatMessageCallback = useCallback((data: { user: string; contenu: string; cree: Date }) => {
    console.log('Message reçu:', data);

    const newMessage: ChatMessage = {
      author: data.user,
      text: data.contenu,
      timestamp: new Date(data.cree),
    };
    setChatMessages((prev) => [...prev, newMessage]); //ajoute le nouveau message dans les messages actuels
  }, []);

  //connexion websocket si roomcode existe
  const { isConnected, error, sendUpdate, sendMessage, addStreamToPlaylist, setMainStream, changeRoomMode, addAnnotation } = useSocket({
    codePartage,
    pseudo: userPseudo,
    // Callback appelé quand le serveur demande une synchronisation de l'état de lecture
    // data contient: etat ('PLAY' ou 'PAUSE'), timestamp (position vidéo), videoId (ID de la vidéo)
    onSyncState: useCallback((data) => {
      console.log('Reçu sync_state:', data);

      if (data.role) {
        console.log('Rôle mis à jour depuis le serveur:', data.role);
        setUserRole(data.role);
      }
      //mise a jour du mode
      if (data.mode) setRoomMode(data.mode);
      if (data.angles) console.log('Angles reçus du serveur (non utilisés):', data.angles);

      // Applique l'état de synchronisation via la référence du player
      if (applySyncStateRef.current) {
        applySyncStateRef.current(data.etat, data.timestamp, data.videoId);
      }
      // Mise à jour de la playlist complète si fournie (ex: à l'arrivée dans le salon)
      if (data.playlist) {
        setPlaylist(data.playlist);
      }
      // Mise à jour de la vidéo principale active
      if (data.activeElementId) {
        const activeElement = data.playlist?.find((el: any) => el.id_element_playlist === data.activeElementId);
        if (activeElement) {
          setMainVideoId(activeElement.video_id);
          setMainFournisseur(activeElement.fournisseur);
        }
      }
    }, []),
    onChatMessage: onChatMessageCallback,
    onStreamAdded: useCallback((element: StreamElement) => {
      console.log('Stream added:', element);
      setPlaylist(prev => [...prev, element]);
    }, []),
    onMainStreamChanged: useCallback((elementPlaylistId: number, videoId: string, fournisseur: string) => {
      console.log('Main stream changed:', elementPlaylistId);
      setMainVideoId(videoId);
      setMainFournisseur(fournisseur);
    }, []),
    onRoomModeChanged: useCallback((mode: 'STANDARD' | 'SPORTS_ANALYSIS', newAngles: any[]) => {
      setRoomMode(mode);
      console.log('Angles du mode sport reçus:', newAngles);
      // Désactiver le dessin si on quitte le mode sport
      if (mode !== 'SPORTS_ANALYSIS') {
        setIsDrawingEnabled(false);
      }
    }, []),
    onNewAnnotation: useCallback((annotation: AnnotationPayload) => {
      if (annotation.type === 'CLEAR') {
        setAnnotations([]);
      } else if (annotation.type === 'SYNC_SECONDARY') {
        setSecondarySlots(annotation.payload);
      } else {
        setAnnotations(prev => [...prev, annotation]);
      }
    }, []),
    onUserJoined: useCallback((_pseudo: string) => {
      // Ratrappage pour les nouveaux : le HOST leur envoie l'état local actuel des slots
      if (userRole === 'HOST') {
        broadcastSecondarySlots(secondarySlotsRef.current);
      }
      setParticipants((prev) => {
        if (prev.some((p) => p.pseudo === _pseudo)) return prev;
        return [...prev, { pseudo: _pseudo, role: 'MEMBER' }];
      });
    }, [userRole, broadcastSecondarySlots]),
  });

  // Maintenir la réf à jour
  useEffect(() => {
    addAnnotationRef.current = addAnnotation;
  }, [addAnnotation]);

  //stocker sendUpdate dans ref
  useEffect(() => {
    sendUpdateRef.current = sendUpdate;
  }, [sendUpdate]);

  //meme chose pour sendMessage
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  //auto-scroll vers le bas si un nouveau message arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; //scrollHeight = tout en bas
    }
  }, [chatMessages]);

  // Récupère la liste des participants depuis l'API
  useEffect(() => {
    if (!codePartage) return;

    const loadParticipants = async () => {
      try {
        const response = await fetch(`/salon/${codePartage}/participants`);
        if (!response.ok) return;
        const data = await response.json() as { participants?: Participant[] };
        if (data.participants) {
          setParticipants(data.participants);
        }
      } catch (err) {
        console.error('Erreur chargement participants:', err);
      }
    };

    loadParticipants();
  }, [codePartage]);

  //callbacks stables pour le player
  const onPlayPauseCallback = useCallback((willPlay: boolean, timestamp: number) => {
    if (userRole !== 'HOST') return; //check si c'est le HOST qui fait cette demande
    console.log('Play/Pause:', { willPlay, timestamp });
    if (sendUpdateRef.current) {
      sendUpdateRef.current(willPlay ? 'PLAY' : 'PAUSE', timestamp);
    }
  }, [userRole]);

  const onSeekCallback = useCallback((timestamp: number) => {
    if (userRole !== 'HOST') return;
    console.log('Seek:', { timestamp });
    if (sendUpdateRef.current) {
      sendUpdateRef.current('PLAY', timestamp);
    }
  }, [userRole]);

  const onVideoChangeCallback = useCallback((videoId: string) => {
    if (userRole !== 'HOST') return;
    console.log('Video change:', { videoId });
    if (sendUpdateRef.current) {
      sendUpdateRef.current('PAUSE', 0, videoId);
    }
  }, [userRole]);

  //la video afficher dans le flux principal (soit celle du serveur, soit celle de l'utilisateur choisi dans le mini-flux)
  const displayedVideoId = localMainVideoId ?? mainVideoId;

  //gestion du lecteur YouTube
  const {
    containerRef,
    isPlaying,
    currentTime,
    volume,
    isFullscreen,
    seekPercentage,
    playPause,
    seek,
    setVolumeLevel,
    toggleFullscreen,
    applySyncState,
  } = useYouTubePlayer({
    syncCallbacks: {
      onPlayPause: onPlayPauseCallback,
      onSeek: onSeekCallback,
      onVideoChange: onVideoChangeCallback,
    },
    mainVideoId: displayedVideoId,
    mainFournisseur,
  });

  //stocker applySyncState dans ref
  useEffect(() => {
    applySyncStateRef.current = applySyncState;
  }, [applySyncState]);

  //gestion de l'envoi de message dans le chat
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault(); //refresh pas la page entière
    if (!chatInput.trim()) {
      console.warn('Message vide');
      return;
    }
    const newMessage: ChatMessage = { //cree un message localement que l'utilisateur a mis
      author: userPseudo,
      text: chatInput,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newMessage]);   //et l'ajoute directement localement dans la liste
    if (sendMessageRef.current) { //envoi dans le socket le message au autres utilisateurs
      sendMessageRef.current(chatInput);
    }
    setChatInput(''); //reset input
  };

  //gestion de l'ajout de vidéo (seulement pour HOST)
  const handleAddVideo = useCallback((url: string) => {
    if (userRole !== 'HOST') {
      console.warn('Seul l\'hôte peut ajouter des vidéos');
      return;
    }
    const videoID = extractVideoID(url);
    if (!videoID) {
      alert('Veuillez entrer une URL YouTube valide.');
      return;
    }
    // Vérifier les doublons
    if (playlist.some(v => v.video_id === videoID)) {
      alert('Cette vidéo est déjà dans la playlist.');
      return;
    }
    addStreamToPlaylist('YOUTUBE', videoID);
  }, [userRole, playlist, addStreamToPlaylist]);

  //extraction d'ID YouTube
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

  //ui d'état de connexion (uniquement si roomCode existe)
  const ConnectionStatus = () => {
    if (!codePartage) return null; //pas de statut si il n'est pas dans un salon valide
    if (error) {
      return (
        <div className="bg-red-600 text-white px-4 py-2 rounded-lg mb-4">
          Erreur: {error}
        </div>              //si il n'arrive pas a se connecter
      );
    }
    if (!isConnected) {
      return (
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg mb-4 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Connexion au serveur...
        </div>      //entrain de faire une connexion vers le serv
      );
    }
    return (
      <div className="bg-green-600 text-white px-4 py-2 rounded-lg mb-4">
        Connecté - Synchronisé avec le salon
      </div>      //si réussi
    );
  };

  //badge pour afficher le role de l'utilisateur
  const RoleBadge = () => (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${userRole === 'HOST'
        ? 'bg-yellow-500 text-gray-900'
        : 'bg-gray-600 text-gray-200'
        }`}
    >
      {userRole === 'HOST' ? 'Hote' : 'Membre'}
    </span>
  );

  const handleCopyRoomCode = useCallback(async () => {
    if (!codePartage) return;
    try {
      await navigator.clipboard.writeText(codePartage);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    } finally {
      setTimeout(() => setCopyStatus('idle'), 1800);
    }
  }, [codePartage]);

  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      {/* Header avec bouton ajout vidéo uniquement visible pour le HOST */}
      <Header showSearch onAddVideo={userRole === 'HOST' ? handleAddVideo : undefined} />
      <main className="flex flex-1 overflow-hidden">
        <Sidebar />
        <section className="flex flex-col flex-1 bg-gray-900 p-6 overflow-hidden">
          {/* statut de connexion */}
          <ConnectionStatus />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-3 md:space-y-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-anton font-bold">
                Salon: {roomName}
              </h1>
              <span className="inline-flex items-center rounded-full bg-gray-800 border border-gray-600 px-3 py-1 text-xs font-mono tracking-wide text-blue-300">
                Code: {codePartage || '------'}
              </span>
              <button
                onClick={handleCopyRoomCode}
                type="button"
                disabled={!codePartage}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${codePartage
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                title={codePartage ? 'Copier le code du salon' : 'Code indisponible'}
              >
                {copyStatus === 'copied' ? 'Copié' : copyStatus === 'error' ? 'Erreur copie' : 'Copier'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {userRole === 'HOST' ? (
                <button
                  onClick={() => changeRoomMode(roomMode === 'STANDARD' ? 'SPORTS_ANALYSIS' : 'STANDARD')}
                  className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors ${roomMode === 'SPORTS_ANALYSIS'
                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                    : 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300'
                    }`}
                >
                  {roomMode === 'SPORTS_ANALYSIS' ? 'Analyse Sportive' : 'Standard'}
                </button>
              ) : roomMode === 'SPORTS_ANALYSIS' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-red-600/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                  Analyse Sportive
                </span>
              )}
              <p className="text-gray-400">Connecté en tant que: {userPseudo}</p>
              <RoleBadge />
            </div>
          </div>

          <div className="flex flex-1 space-x-6 overflow-hidden">
            {/* lecteur vidéo youtube */}
            <div className="flex flex-col flex-1 bg-black rounded-lg shadow-lg overflow-hidden">

              {/* mini flux dans le mode sportive */}
              {roomMode === 'SPORTS_ANALYSIS' && (
                <div className="bg-gray-800 border-b border-gray-700 p-3 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Flux secondaires</p>
                    {localMainVideoId && (
                      <button
                        onClick={() => {
                          setLocalMainVideoId(null);
                          setLocalMainSlotIdx(null);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                      >
                        Retour à la vidéo principale
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {secondarySlots.map((slotVideoId, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-gray-900 rounded-lg overflow-hidden flex flex-col"
                        style={{ maxWidth: '33%' }}
                      >
                        {slotVideoId ? (
                          //si le slot est rempli alors on affiche le lecteur secondaire cliquable
                          <>
                            <SecondaryVideo
                              videoId={slotVideoId}
                              isPlaying={isPlaying}
                              currentTime={currentTime}
                              label={`ANGLE ${idx + 1}`}
                              isSelected={localMainSlotIdx === idx}
                              onClick={() => {
                                if (localMainSlotIdx === idx) {
                                  //si le slot est deja selectionner alors on le deselectionne et s'enleve de la video principale
                                  setLocalMainVideoId(null);
                                  setLocalMainSlotIdx(null);
                                } else {
                                  //sinon on le selectionne et s'ajoute a la video principale
                                  setLocalMainVideoId(slotVideoId);
                                  setLocalMainSlotIdx(idx);
                                }
                              }}
                            />
                            {userRole === 'HOST' && (
                              //si c'est l'hote alors on affiche le bouton retirer
                              <button
                                onClick={() => {
                                  const updated = [...secondarySlots];
                                  updated[idx] = null;
                                  setSecondarySlots(updated);
                                  broadcastSecondarySlots(updated);
                                  //met a jour l'etat local si le slot retire est celui de la video principale
                                  if (localMainSlotIdx === idx) {
                                    setLocalMainVideoId(null);
                                    setLocalMainSlotIdx(null);
                                  }
                                }}
                                className="w-full py-1 text-[10px] font-semibold text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors"
                              >
                                Retirer
                              </button>
                            )}
                          </>
                        ) : (
                          //si ce slot est vide alors on affiche un message dans ce slot vide
                          <div className="flex flex-col items-center justify-center p-3 gap-1 ring-1 ring-gray-700 rounded-lg" style={{ minHeight: 100 }}>
                            <span className="text-sm text-gray-500">ANGLE {idx + 1}</span>
                            <span className="text-[15px] text-gray-600 italic">
                              {userRole === 'HOST' ? 'Utilisez + dans la playlist' : 'En attente de l\'hôte...'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {localMainVideoId && (
                    <p className="text-[10px] text-blue-400 mt-2 text-center">
                      Vous visionnez un angle secondaire en local — les autres participants voient la vidéo principale
                    </p>
                  )}
                </div>
              )}

              {/* conteneur du player youtube principal */}
              <div className="relative w-full grow pt-[56.25%] bg-black">
                <div ref={containerRef} className="absolute inset-0"></div>

                {/* Overlay Annotations */}
                {roomMode === 'SPORTS_ANALYSIS' && (
                  <AnnotationOverlay
                    annotations={annotations}
                    isDrawingEnabled={isDrawingEnabled}
                    activeTool={activeTool}
                    color={annotationColor}
                    pendingText={textInput}
                    onAddAnnotation={(payload, type) => {
                      addAnnotation({
                        id_angle: null,
                        timestamp_video: currentTime,
                        type,
                        payload,
                      });
                    }}
                  />
                )}

                {/* overlay transparent qui bloque les interactions avec YouTube (play/pause via click) */}
                {blockClicks && (!isDrawingEnabled || roomMode !== 'SPORTS_ANALYSIS') && (
                  <div className="absolute inset-0 z-40 bg-transparent cursor-not-allowed" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} onContextMenu={(e) => { e.preventDefault(); }} onDragStart={(e) => { e.preventDefault(); }} />
                )}
              </div>

              {/* outils d'annotation (visible à tous les utilisateurs en mode sport) */}
              {roomMode === 'SPORTS_ANALYSIS' && (
                <div className="flex flex-wrap items-center gap-3 bg-gray-900 px-4 py-2 border-b border-gray-700 select-none">
                  <span className="text-sm font-semibold text-gray-400 whitespace-nowrap">Annotations :</span>

                  {/* bouton pour activer/désactiver les annotations */}
                  <button
                    onClick={() => setIsDrawingEnabled(!isDrawingEnabled)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-2 ${isDrawingEnabled ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                  >
                    {isDrawingEnabled ? 'Désactiver' : 'Annoter'}
                  </button>

                  {isDrawingEnabled && (
                    <>
                      {/* bouton pour dessiner ou texte*/}
                      <div className="flex rounded overflow-hidden border border-gray-600">
                        <button
                          onClick={() => setActiveTool('draw')}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTool === 'draw' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                          Dessin
                        </button>
                        <button
                          onClick={() => setActiveTool('text')}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTool === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                          Texte
                        </button>
                      </div>

                      {/* palette de couleurs */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-400">Couleur :</label>
                        {['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ffffff'].map((c) => (
                          <button
                            key={c}
                            onClick={() => setAnnotationColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded-full border-2 transition-transform ${annotationColor === c ? 'border-white scale-125' : 'border-transparent'
                              }`}
                          />
                        ))}
                      </div>

                      {/* un champ de texte pour le texte */}
                      {activeTool === 'text' && (
                        <input
                          type="text"
                          placeholder="Texte à placer…"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          className="px-2 py-1 rounded text-xs bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                        />
                      )}
                    </>
                  )}

                  {/* efface les annotations pour tout le monde (seulement par le HOST) */}
                  {userRole === 'HOST' && (
                    <button
                      onClick={() => {
                        addAnnotation({
                          id_angle: null,
                          timestamp_video: currentTime,
                          type: 'CLEAR',
                          payload: {},
                        });
                      }}
                      className="ml-auto px-3 py-1.5 rounded text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      title="Efface les dessins pour tout le monde"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              )}

              {/* controles du lecteur youtube */}
              <div className="flex items-center justify-between bg-gray-800 px-4 py-3 border-t border-gray-700 text-white select-none space-x-4">
                {/* bouton play/pause desactiver pour les membres */}
                <button
                  onClick={playPause}
                  disabled={userRole !== 'HOST'}
                  aria-label={isPlaying ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
                  title={userRole !== 'HOST' ? 'Seul l\'hôte peut contrôler la lecture' : undefined}
                  className={`px-4 py-2 rounded flex items-center justify-center transition-colors ${userRole === 'HOST'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                    }`}
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 5.25h-1.5a.75.75 0 00-.75.75v12a.75.75 0 00.75.75h1.5a.75.75 0 00.75-.75v-12a.75.75 0 00-.75-.75zm6 0h-1.5a.75.75 0 00-.75.75v12a.75.75 0 00.75.75h1.5a.75.75 0 00.75-.75v-12a.75.75 0 00-.75-.75z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.92-1.398 1.665-.965l11.54 6.347a1.125 1.125 0 010 1.93l-11.54 6.347a1.125 1.125 0 01-1.665-.965V5.653z" />
                    </svg>
                  )}
                </button>

                {/* barre de progression (desactiver pour les membres) */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={seekPercentage}
                  onChange={(e) => seek(Number(e.target.value))}
                  disabled={userRole !== 'HOST'}
                  title={userRole !== 'HOST' ? 'Seul l\'hôte peut modifier la progression' : undefined}
                  className={`flex-1 accent-blue-500 ${userRole === 'HOST' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                />

                {/* barre de volume accessible a tous (local seulement, pas de sync) */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  title="Volume (local)"
                  className="w-24 cursor-pointer accent-blue-500"
                />

                {/* bouton pour le plein écran accessible a tous */}
                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Quitter le plein écran' : 'Activer le plein écran'}
                  className="px-4 py-2 rounded flex items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.188 8.812L4.5 4.125M4.5 4.125h4.688M4.5 4.125v4.688M14.813 8.812l4.687-4.687M19.5 4.125h-4.688M19.5 4.125v4.688M9.188 15.188L4.5 19.875M4.5 19.875h4.688M4.5 19.875v-4.688M14.813 15.188l4.687 4.687M19.5 19.875h-4.688M19.5 19.875v-4.688" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75l5.25 5.25m0 0V3.75m0 5.25H3.75M20.25 3.75l-5.25 5.25m0 0V3.75m0 5.25h5.25M3.75 20.25l5.25-5.25m0 0v5.25m0-5.25H3.75M20.25 20.25l-5.25-5.25m0 0v5.25m0-5.25h5.25" />
                    </svg>
                  )}
                </button>
              </div>

              {/* message pour les membres */}
              {userRole !== 'HOST' && (
                <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-center text-xs text-gray-400">
                  Vous êtes en mode spectateur — seul l'hôte peut contrôler la lecture
                </div>
              )}
            </div>

            {/* sidebar playlist et chat */}
            <aside className="w-80 flex flex-col space-y-6 overflow-hidden">
              {/* liste vidéos dans playlist*/}
              <section className="bg-gray-800 rounded-lg p-4 flex flex-col max-h-[50vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">Playlist
                  {userRole === 'HOST' && (
                    <span className="text-xs text-yellow-400 font-normal">(cliquez pour changer)</span>
                  )}
                </h2>
                <ul className="space-y-2">
                  {/* c'est le HOST peut faire des manipulation que les members ne peuvent rien faire*/}
                  {playlist.map((video) => {
                    //logique pour le bouton "+" pour les mini flux (mode Sportive, hôte seulement)
                    const isAlreadyInSlot = secondarySlots.includes(video.video_id);
                    const allSlotsFull = secondarySlots.every(s => s !== null);
                    const canAddToSlot = roomMode === 'SPORTS_ANALYSIS' && userRole === 'HOST' && !isAlreadyInSlot && !allSlotsFull;
                    const showSlotBtn = roomMode === 'SPORTS_ANALYSIS' && userRole === 'HOST';

                    return (
                      <li
                        key={video.id_element_playlist}
                        title={userRole !== 'HOST' ? 'Seul l\'hôte peut changer la vidéo' : `Lire: ${video.video_id}`}
                        className={`px-3 py-2 rounded text-sm flex items-center justify-between gap-2 ${mainVideoId === video.video_id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-200'
                          }`}
                      >
                        <span
                          className={`truncate flex-1 ${userRole === 'HOST' ? 'cursor-pointer hover:underline' : 'cursor-default'
                            }`}
                          onClick={() => {
                            if (userRole === 'HOST') {
                              setMainStream(video.id_element_playlist);
                            }
                          }}
                        >
                          {video.fournisseur}: {video.video_id}
                        </span>
                        {/* bouton "+" pour ajouter aux mini-flux (mode Sportive, hôte seulement) */}
                        {showSlotBtn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canAddToSlot) return;
                              const firstFreeIdx = secondarySlots.findIndex(s => s === null);
                              if (firstFreeIdx === -1) return;
                              const updated = [...secondarySlots];
                              updated[firstFreeIdx] = video.video_id;
                              setSecondarySlots(updated);
                              broadcastSecondarySlots(updated);
                            }}
                            disabled={!canAddToSlot}
                            title={
                              isAlreadyInSlot
                                ? 'Déjà dans un mini-flux'
                                : allSlotsFull
                                  ? 'Tous les slots sont remplis'
                                  : 'Ajouter dans les mini-flux'
                            }
                            className={`shrink-0 w-7 h-7 rounded flex items-center justify-center text-xl font-bold transition-colors ${canAddToSlot
                              ? 'bg-blue-700 hover:bg-blue-400 text-white cursor-pointer'
                              : 'bg-gray-600 text-gray-500 cursor-not-allowed opacity-50'
                              }`}
                          >
                            +
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {playlist.length === 0 && (
                  <p className="text-gray-400 text-center py-4 text-sm">
                    {userRole === 'HOST'
                      ? 'Ajoutez une vidéo via la barre de recherche'
                      : 'Aucune vidéo dans la playlist'}
                  </p>
                )}
              </section>

              {/* chat */}
              <section className="bg-gray-800 rounded-lg p-4 flex flex-col max-h-[40vh] overflow-hidden">
                <h2 className="text-lg font-semibold mb-3">Chat</h2>
                {/* messages */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto mb-2 space-y-2 bg-gray-900 p-3 rounded"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Aucun message pour le moment
                    </p>
                  ) : (
                    chatMessages.map((msg, index) => {
                      const isOwnMessage = msg.author === userPseudo;
                      return (
                        <div
                          key={index}                                                           //justify-end = droite = ownmessage
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}  //justify-start = gauche = autre utilisateur du salon
                        >
                          <div
                            className={`max-w-xs px-3 py-2 rounded-lg ${isOwnMessage
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-200'
                              }`}
                          >
                            <p className="text-xs font-semibold mb-1">
                              {isOwnMessage ? 'Vous' : msg.author} {msg.timestamp.getHours()}:{msg.timestamp.getMinutes()}
                            </p>
                            <p className="text-sm wrap-break-words">{msg.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* envoi de message */}
                <form onSubmit={handleChatSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Écrire un message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 min-w-0 rounded px-3 py-2 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  <button type="submit" className="bg-blue-900 px-4 py-2 rounded hover:bg-blue-800 transition-colors">
                    Envoyer
                  </button>
                </form>
              </section>
            </aside>
          </div>

          <footer className="bg-gray-800 border-t border-gray-700 p-4 flex items-center space-x-4 overflow-x-auto mt-4">
            <h3 className="font-semibold">Participants :</h3>
            <div className="flex space-x-3">
              {participants.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun participant trouvé</p>
              ) : (
                participants.map((participant) => (
                  <span
                    key={participant.pseudo}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${participant.role === 'HOST'
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-700 text-gray-200'
                      }`}
                  >
                    {participant.pseudo}
                    {participant.role === 'HOST' ? ' (Hote)' : ''}
                  </span>
                ))
              )}
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}

