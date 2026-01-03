import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncState {
  etat: 'PLAY' | 'PAUSE';
  timestamp: number;
  videoId?: string;
}

interface UseSocketOptions {
  codePartage: string;
  pseudo: string;
  onSyncState: (data: SyncState) => void; //utlisée pour faire un callback si un sync state est reçu
}

export const useSocket = ({ codePartage, pseudo, onSyncState }: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const onSyncStateRef = useRef(onSyncState); //stocker le callback dans un ref
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //mettre à jour le ref quand le callback change (sans déclencher useEffect)
  useEffect(() => {
    onSyncStateRef.current = onSyncState;
  }, [onSyncState]);

  useEffect(() => {
    //connexion au serveur Socket.IO
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
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
  return {
    isConnected,
    error,
    sendUpdate,
  };
};