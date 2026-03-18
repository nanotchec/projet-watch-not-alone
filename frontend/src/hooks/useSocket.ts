import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncState {
  etat: 'PLAY' | 'PAUSE';
  timestamp: number;
  videoId?: string;
  fournisseur?: string;
  playlist?: any[];
  activeElementId?: number;
  // Le serveur peut envoyer le rôle lors du sync_state initial (join_salon)
  role?: 'HOST' | 'MEMBER';
}

interface ChatMessage {
  user: string;
  contenu: string;
  cree: Date;
}

interface StreamElement {
  id_element_playlist: number;
  fournisseur: string;
  video_id: string;
  position: number;
  etat_lecture: string;
  horodatage_sec: number;
}

interface UseSocketOptions {
  codePartage: string;
  pseudo: string;
  onSyncState: (data: SyncState) => void; //utlisée pour faire un callback si un sync state est reçu
  onChatMessage?: (message: ChatMessage) => void; //de même pour le chat
  onStreamAdded?: (element: StreamElement) => void;
  onMainStreamChanged?: (elementPlaylistId: number, videoId: string, fournisseur: string) => void;
}

export const useSocket = ({
  codePartage,
  pseudo,
  onSyncState,
  onChatMessage,
  onStreamAdded,
  onMainStreamChanged,
}: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const onSyncStateRef = useRef(onSyncState); //stocker le callback dans un ref
  const onChatMessageRef = useRef(onChatMessage); //même chose pour le chat
  const onStreamAddedRef = useRef(onStreamAdded);
  const onMainStreamChangedRef = useRef(onMainStreamChanged);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mettre à jour les refs quand les callbacks changent (sans déclencher useEffect)
  useEffect(() => { onSyncStateRef.current = onSyncState; }, [onSyncState]);
  useEffect(() => { onChatMessageRef.current = onChatMessage; }, [onChatMessage]);
  useEffect(() => { onStreamAddedRef.current = onStreamAdded; }, [onStreamAdded]);
  useEffect(() => { onMainStreamChangedRef.current = onMainStreamChanged; }, [onMainStreamChanged]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'localhost:3000';
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    //gestion de la connexion
    socket.on('connect', () => {
      console.log('Socket connecté');
      setIsConnected(true);
      setError(null);

      socket.emit('join_salon', { codePartage, pseudo });
      console.log(`Demande de join_salon envoyée pour ${codePartage}`);
    });

    //gestion de la déconnexion
    socket.on('disconnect', (reason) => {
      console.log('Socket déconnecté:', reason);
      setIsConnected(false);
    });

    //ecouter les mises à jour de synchronisation
    socket.on('sync_state', (data: SyncState) => {
      console.log('sync_state reçu:', data);
      //utiliser le ref au lieu du paramètre direct
      onSyncStateRef.current(data);
    });

    //écoute les updates de message du chat
    socket.on('chat_update', (data: ChatMessage) => {
      console.log('chat_update reçu:', data);
      if (onChatMessageRef.current) {
        onChatMessageRef.current(data);
      }
    });

    socket.on('stream_added', (element: StreamElement) => {
      console.log('stream_added reçu:', element);
      if (onStreamAddedRef.current) {
        onStreamAddedRef.current(element);
      }
    });

    socket.on('main_stream_changed', (elementPlaylistId: number, videoId: string, fournisseur: string) => {
      console.log('main_stream_changed reçu:', elementPlaylistId,videoId,fournisseur);
      if (onMainStreamChangedRef.current) {
        onMainStreamChangedRef.current(elementPlaylistId,videoId,fournisseur);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Erreur de connexion:', err);
      setError('Impossible de se connecter au serveur');
    });

    socket.on('error', (err) => {
      console.error('Erreur socket:', err);
      setError(err.message || 'Une erreur est survenue');
    });

    //cleanup à la déconnexion du composant
    return () => {
      console.log('Déconnexion du socket');
      socket.disconnect();
    };
  }, [codePartage, pseudo]);

  // BUG FIX: le backend vérifie le rôle HOST via `pseudo` dans update_state
  // Il faut obligatoirement inclure `pseudo` dans le payload sinon le serveur
  // ne peut pas retrouver la participation et refuse l'action (même pour un HOST)
  const sendUpdate = (etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible d\'envoyer update_state');
      return;
    }
    const payload = {
      codePartage,
      pseudo,      // ← OBLIGATOIRE: le backend en a besoin pour vérifier le rôle HOST
      etat,
      timestamp,
      ...(videoId && { videoId }),
    };
    console.log('Envoi update_state:', payload);
    socketRef.current.emit('update_state', payload);
  };

  const sendMessage = (contenu: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible d\'envoyer le message');
      return;
    }
    if (!contenu.trim()) {
      console.warn('Message vide, envoi annulé');
      return;
    }
    const payload = {
      codePartage,
      contenu,
      cree: new Date(),
      user: pseudo,
    };
    console.log('Envoi update_message:', payload);
    socketRef.current.emit('update_message', payload);
  };

  const addStreamToPlaylist = (fournisseur: string, videoId: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible d\'ajouter un stream');
      return;
    }
    const payload = { codePartage, pseudo, fournisseur, videoId };
    console.log('Envoi add_stream_to_playlist:', payload);
    socketRef.current.emit('add_stream_to_playlist', payload);
  };

  const setMainStream = (elementPlaylistId: number) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible de changer le stream principal');
      return;
    }
    const payload = { codePartage, pseudo, elementPlaylistId };
    console.log('Envoi set_main_stream:', payload);
    socketRef.current.emit('set_main_stream', payload);
  };

  return {
    isConnected,
    error,
    sendUpdate,
    sendMessage,
    addStreamToPlaylist,
    setMainStream,
  };
};