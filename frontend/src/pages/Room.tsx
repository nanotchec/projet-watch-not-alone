import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useYouTubePlayer } from '../services/useYouTubePlayer';
import { useSocket } from '../hooks/useSocket';

interface LocationState {   //variables qui ne peuvent pas etre "modifier" directement dans l'url
  salonName?: string;
  userPseudo?: string;
  codePartage?: string;
}

export default function Room() {
  //récupère les paramètres des states venant du formulaire de CreationApp
  const { code } = useParams<{code: string}>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const [roomName] = useState(state?.salonName || 'undefined salon')
  const [userPseudo] = useState(state?.userPseudo || 'undefined username');
  const [codePartage] = useState(code || state?.codePartage || '');
  const [blockClicks] = useState(true); //bloque les click sur le vidéo container

  //valeurs pour le chat et le salon
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; author: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  //gestion du lecteur youtube
  const applySyncStateRef = useRef<((etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => void) | null>(null);
  const sendUpdateRef = useRef<((etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => void) | null>(null);

  useEffect(() => {   //si aucun code du salon valide n'est récupérable alors retourne une erreur puis kick vers Creation
    if(!codePartage){
      console.error('Code de salon introuvable, redirection vers creation de salon');
      navigate('/creation');
    }
    if (userPseudo === 'undefiend username'){ //meme chose s'il n'a pas de pseudo non defini
      console.error('Pseudo non identifiable, redirection vers creation de salon');
      navigate('/creation');
    }
  }, [codePartage, navigate]);

  //connexion websocket si roomcode existe
  const { isConnected, error, sendUpdate } = useSocket({
    codePartage,
    pseudo: userPseudo,
    // Callback appelé quand le serveur demande une synchronisation de l'état de lecture
    // data contient: etat ('PLAY' ou 'PAUSE'), timestamp (position vidéo), videoId (ID de la vidéo)
    onSyncState: useCallback((data) => {
      console.log('Reçu sync_state:', data);
      // Applique l'état de synchronisation via la référence du player
      if (applySyncStateRef.current) {
        applySyncStateRef.current(data.etat, data.timestamp, data.videoId);
      }
    }, []),
  });

  //stocker sendUpdate dans ref
  useEffect(() => {
    sendUpdateRef.current = sendUpdate;
  }, [sendUpdate]);

  //callbacks stables pour le player
  const onPlayPauseCallback = useCallback((willPlay: boolean, timestamp: number) => {
    console.log('Play/Pause:', { willPlay, timestamp });
    if (sendUpdateRef.current) {
      sendUpdateRef.current(willPlay ? 'PLAY' : 'PAUSE', timestamp);
    }
  }, []);

  const onSeekCallback = useCallback((timestamp: number) => {
    console.log('Seek:', { timestamp });
    if (sendUpdateRef.current) {
      sendUpdateRef.current('PLAY', timestamp);
    }
  }, []);

  const onVideoChangeCallback = useCallback((videoId: string) => {
    console.log('Video change:', { videoId });
    if (sendUpdateRef.current) {
      sendUpdateRef.current('PAUSE', 0, videoId);
    }
  }, []);

  //gestion du lecteur YouTube
  const {
    containerRef,
    playlist,
    currentVideoIndex,
    isPlaying,
    volume,
    isFullscreen,
    seekPercentage,
    playPause,
    seek,
    setVolumeLevel,
    toggleFullscreen,
    loadVideo,
    addVideo,
    applySyncState,
  } = useYouTubePlayer({
    syncCallbacks: {
      onPlayPause: onPlayPauseCallback,
      onSeek: onSeekCallback,
      onVideoChange: onVideoChangeCallback,
    },
  });

  //stocker applySyncState dans ref
  useEffect(() => {
    applySyncStateRef.current = applySyncState;
  }, [applySyncState]);

  //gestion de l'envoi de message dans le chat
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages([...chatMessages, { text: chatInput, author: 'Moi' }]);
    setChatInput('');
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

  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      <Header showSearch onAddVideo={addVideo} />
      <main className="flex flex-1 overflow-hidden">
        <Sidebar />
        <section className="flex flex-col flex-1 bg-gray-900 p-6 overflow-hidden">
          {/* statut de connexion */}
          <ConnectionStatus />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-3 md:space-y-0">
            <h1 className="text-2xl font-anton font-bold">
              Salon: {roomName} ({codePartage})
            </h1>
            <p className="text-gray-400">Connecté en tant que: {userPseudo}</p>
          </div>

          <div className="flex flex-1 space-x-6 overflow-hidden">
            {/* lecteur vidéo youtube */}
            <div className="flex flex-col flex-1 bg-black rounded-lg shadow-lg overflow-hidden">
              {/* conteneur du player youtube */}
              <div className="relative w-full flex-grow pt-[56.25%] bg-black">
                <div ref={containerRef} className="absolute inset-0"></div>
                {/* overlay transparent qui bloque les interactions */}
                {blockClicks && (
                  <div className="absolute inset-0 z-40 bg-transparent cursor-not-allowed" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} onContextMenu={(e) => { e.preventDefault(); }} onDragStart={(e) => { e.preventDefault(); }}/>
                )}
              </div>

              {/* controles du lecteur youtube */}
              <div className="flex items-center justify-between bg-gray-800 px-4 py-3 border-t border-gray-700 text-white select-none space-x-4">
                <button
                  onClick={playPause}
                  aria-label={isPlaying ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center justify-center"
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

                {/* barre de progression */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={seekPercentage}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="flex-1 cursor-pointer"
                />

                {/* barre de volume */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="w-24 cursor-pointer"
                />

                {/* bouton pour le plein écran */}
                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Quitter le plein écran' : 'Activer le plein écran'}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center justify-center"
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
            </div>

            {/* sidebar playlist et chat */}
            <aside className="w-80 flex flex-col space-y-6 overflow-hidden">
              {/* liste vidéos dans playlist*/}
              <section className="bg-gray-800 rounded-lg p-4 flex flex-col max-h-[50vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-3">Playlist</h2>
                <ul className="space-y-2">
                  {playlist.map((video, index) => (
                    <li
                      key={index}
                      onClick={() => loadVideo(index)}
                      className={`cursor-pointer px-2 py-1 rounded hover:bg-blue-700 ${
                        index === currentVideoIndex ? 'bg-blue-600 text-white' : ''
                      }`}
                    >
                      {video.title}
                    </li>
                  ))}
                </ul>
              </section>

              {/* chat */}
              <section className="bg-gray-800 rounded-lg p-4 flex flex-col max-h-[40vh] overflow-hidden">
                <h2 className="text-lg font-semibold mb-3">Chat</h2>
                {/* messages */}
                <div className="flex-1 overflow-y-auto mb-2 space-y-2 bg-gray-900 p-3 rounded">
                  {chatMessages.map((msg, index) => (
                    <p key={index} className="bg-blue-600 rounded px-2 py-1 max-w-xs">
                      {msg.author} : {msg.text}
                    </p>
                  ))}
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
                  <button type="submit" className="bg-blue-900 px-4 py-2 rounded hover:bg-blue-800">
                    Envoyer
                  </button>
                </form>
              </section>
            </aside>
          </div>

          <footer className="bg-gray-800 border-t border-gray-700 p-4 flex items-center space-x-4 overflow-x-auto">
            <h3 className="font-semibold">Participants :</h3>
            <div className="flex space-x-3">
              {/* A faire: ajouter les participants ici */}
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}

