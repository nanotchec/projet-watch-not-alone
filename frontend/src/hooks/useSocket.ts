import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncState {
  etat: 'PLAY' | 'PAUSE';
  timestamp: number;
  videoId?: string;
}

interface ChatMessage {
  user: string;
  contenu: string;
  cree: Date;
}

interface UseSocketOptions {
  codePartage: string;
  pseudo: string;
  onSyncState: (data: SyncState) => void; //utlisée pour faire un callback si un sync state est reçu
  onChatMessage?: (message: ChatMessage) => void; //de même pour le chat
}

export const useSocket = ({ codePartage, pseudo, onSyncState, onChatMessage }: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const onSyncStateRef = useRef(onSyncState); //stocker le callback dans un ref
  const onChatMessageRef = useRef(onChatMessage); //même chose pour le chat
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //mettre à jour le ref quand le callback change (sans déclencher useEffect)
  useEffect(() => {
    onSyncStateRef.current = onSyncState;
  }, [onSyncState]);

  //meme chose pour message
  useEffect(() => {
    onChatMessageRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    //connexion au serveur Socket.IO
    const socketUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
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

      //rejoindre le salon
      socket.emit('join_salon', {
        codePartage,
        pseudo,
      });
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

    //gestion des erreurs
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
  }, [codePartage, pseudo]); //retirer les dependances sync state

  //fonction pour envoyer un update_state
  const sendUpdate = (etat: 'PLAY' | 'PAUSE', timestamp: number, videoId?: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible d\'envoyer update_state');
      return;
    }
    const payload = { //construit un payload avec les informmation a synchro sur les users
      codePartage,
      etat,
      timestamp,
      ...(videoId && { videoId }),  //videoId si fourni sinon void
    };
    console.log('Envoi update_state:', payload);
    socketRef.current.emit('update_state', payload);
  };

  //fonction pour envoyer un message de chat ("similaire" a sendUpdate)
  const sendMessage = (contenu: string) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket non connecté, impossible d\'envoyer le message');
      return;
    }
    if (!contenu.trim()) {
      console.warn('Message vide, envoi annulé');
      return;
    }
    const payload = { //un payload avec info synchro sur les users
      codePartage,
      contenu,
      cree: new Date(),
      user: pseudo,
    };
    console.log('Envoi update_message:', payload);
    socketRef.current.emit('update_message', payload);
  };
  return {
    isConnected,
    error,
    sendUpdate,
    sendMessage,
  };
};