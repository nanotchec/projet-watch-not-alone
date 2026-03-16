# Documentation des Sockets - Gestion Multi-flux (Option B)

Ce document décrit les nouveaux événements Socket.IO mis en place côté Backend pour gérer plusieurs vidéos (la playlist) et permettre au `HOST` de choisir la vidéo principale diffusée à tous les membres.

## 1. Initialisation (Mise à jour) : `join_salon`

Lorsqu'un utilisateur rejoint la room (`join_salon`), l'événement de retour `sync_state` a été enrichi.

**Ce que vous recevez via `sync_state` :**
```json
{
  "etat": "PLAY" | "PAUSE",
  "timestamp": 123.45,
  "videoId": "dQw4w9WgXcQ",
  "fournisseur": "YOUTUBE",
  "playlist": [ /* Tableau contenant tous les objets ElementPlaylist du salon */ ],
  "activeElementId": 42 // L'ID du flux principal actuel (id_element_playlist). Peut être null.
}
```

## 2. Ajouter un nouveau flux disponible : `add_stream_to_playlist` (Réservé au HOST)

Cet événement permet d'ajouter un flux vidéo à la playlist partagée par tout le monde. Seul le `HOST` peut effectuer cette action. Le serveur bloquera la requête si un spectateur ordinaire essaie de l'émettre.

**Ce que vous envoyez (`emit`) :**
```json
socket.emit("add_stream_to_playlist", {
  "codePartage": "ABCDEF",
  "pseudo": "MonPseudo",
  "fournisseur": "YOUTUBE", // ou "WEBCAM", "TWITCH", etc.
  "videoId": "L_jWHffIx5E"
});
```

**Ce que tout le monde reçoit (`on`) :**
Le backend répondra en broadcastant l'événement `stream_added` avec le nouvel objet généré en BDD.
```json
socket.on("stream_added", (newElement) => {
  // Ajoutez 'newElement' à votre état Frontend (liste des vidéos)
  // newElement.id_element_playlist, newElement.video_id, etc.
});
```

## 3. Changer le flux principal diffusé : `set_main_stream` 👑 (Réservé au HOST)

Lorsque le propriétaire du salon clique sur une miniature pour la mettre en grand écran pour tout le monde, le frontend envoie cet événement. Le backend refusera l'ordre si l'utilisateur n'est pas le HOST en base de données.

**Ce que le HOST envoie (`emit`) :**
```json
socket.emit("set_main_stream", {
  "codePartage": "ABCDEF",
  "pseudo": "PseudoDuHost",
  "elementPlaylistId": 42 // L'ID provenant de la playlist
});
```

**Ce que tout le monde reçoit (`on`) :**
Le backend valide et met à jour l'élément principal en BDD, puis prévient tous les clients.
```json
socket.on("main_stream_changed", (data) => {
  // data.elementPlaylistId : L'identifiant (42)
  // data.videoId : "L_jWHffIx5E"
  // data.fournisseur : "YOUTUBE"
  // Mettez à jour votre Player principal !
});
```

## 4. Lecture / Pause / Synchronisation du temps : `update_state` (Réservé au HOST)

**⚠️ Attention ! L'envoi de l'événement a été modifié !**
Désormais, **seul le `HOST`** peut modifier l'état de la vidéo (Play, Pause, drag du timestamp). Vous devez obligatoirement envoyer le pseudo de l'utilisateur qui a fait l'action pour que le serveur vérifie ses droits.

**Ce que le HOST envoie (`emit`) :**
```json
socket.emit("update_state", {
  "codePartage": "ABCDEF",
  "pseudo": "PseudoDuHost", // NOUVEAU ! Le backend a besoin de savoir qui demande l'action pour valider le rôle HOST
  "etat": "PLAY",
  "timestamp": 125.4
});
```

Si un utilisateur qui n'est pas "HOST" envoie cet événement, le backend l'ignorera et renverra une erreur socket.
Cet événement modifie désormais l'état spécifiquement de l'élément de playlist actif. La réception par les autres clients via `sync_state` reste inchangée !
