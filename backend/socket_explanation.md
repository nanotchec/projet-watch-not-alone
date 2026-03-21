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

## 5. Mode Analyse Sportive / Multi-Angles (NOUVEAU)

Ce mode permet d'afficher plusieurs angles d'une même vidéo ainsi que d'y ajouter des annotations synchronisées avec le temps de la vidéo.

### L'objet de statut s'enrichit
Dans le `sync_state`, vous recevrez désormais le `mode` du salon (`STANDARD` ou `SPORTS_ANALYSIS`).
Si le mode est `SPORTS_ANALYSIS`, l'élément actif peut potentiellement contenir une liste d'`angles`.
```json
{
  "etat": "PLAY",
  "timestamp": 12.4,
  "mode": "SPORTS_ANALYSIS",
  "activeElementId": 42,
  "angles": [
    { "id_angle": 1, "nom": "Cam 1", "fournisseur": "YOUTUBE", "video_id": "vid1" },
    { "id_angle": 2, "nom": "Cam 2", "fournisseur": "MP4", "video_id": "vid2" }
  ]
}
```

### Changer le mode du salon : `change_room_mode` 👑 (Réservé au HOST)
Permet de basculer l'ensemble du salon dans un mode d'analyse multi-caméras.
**Ce que le HOST envoie (`emit`) :**
```json
socket.emit("change_room_mode", {
  "codePartage": "ABCDEF",
  "pseudo": "PseudoDuHost",
  "mode": "SPORTS_ANALYSIS" // ou "STANDARD"
});
```

**Ce que tout le monde reçoit (`on`) :**
L'événement `room_mode_changed` signalera ce changement, avec la configuration actualisée.
```json
socket.on("room_mode_changed", ({ mode, angles }) => {
  // mode = "SPORTS_ANALYSIS"
});
```

### Ajouter une Annotation : `add_annotation`
Permet de dessiner, d'écrire ou de pointer un élément sur un angle précis, synchronisé à une seconde précise du flux de lecture.
**Ce que vous envoyez (`emit`) :**
```json
socket.emit("add_annotation", {
  "codePartage": "ABCDEF",
  "pseudo": "MonPseudo",
  "id_angle": 1, // Optionnel : Identifiant de la caméra concernée (null = visible sur toutes les cams)
  "timestamp_video": 45.2, // Temps EXACT de la vidéo au moment du tracé (obligatoire)
  "duree_affichage": 2.5, // Optionnel : Durée de disparition en secondes
  "type": "DESSIN", // "DESSIN", "TEXTE", "FLECHE"
  "payload": { "x": 100, "y": 200, "color": "red" } // Contenu / SVG géré par le front
});
```

**Ce que tout le monde reçoit (`on`) :**
Le serveur sauvegarde et rebroadcast immédiatement l'événement sous le nom `new_annotation`.
```json
socket.on("new_annotation", (annotationData) => {
  // Affichez / Mettez en attente l'annotation selon le timestamp
  // et le `id_angle` que regarde l'utilisateur.
  // L'objet contiendra un "id_annotation" unique (ID de BDD)
});
```
