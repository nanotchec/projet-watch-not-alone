# Documentation Intégration Backend

Salut, voila un résumé de ce qui a été mis en place côté Back pour la gestion des salons et la synchro vidéo.

## 1. API REST (Création & Accès)
URL de base : `http://localhost:3000/salon`

### Créer un salon : `POST /`
Body : `{ "nom": "Ciné", "pseudo": "Moi" }`
Réponse : `{ "salon": { "code_partage": "...", ... }, "user": ..., "participation": ... }`

### Rejoindre un salon : `POST /join`
Body : `{ "codePartage": "XYZ123", "pseudo": "Toi" }`
Réponse : Idem que création.
⚠️ Gérer les erreurs : `403` (Banni), `409` (Pseudo pris), `404` (Salon introuvable).

---

## 2. WebSocket (Synchro Vidéo)
Une fois le salon rejoint, connectez-vous au Socket.IO : `ws://localhost:3000`.

### Workflow
1.  **Connexion** : Dès que vous avez le salon, envoyez l'event `join_salon`.
    ```javascript
    socket.emit("join_salon", { codePartage: "XYZ123", pseudo: "Toi" });
    ```

2.  **Réception (Écouter le serveur)** : Le serveur vous enverra un event `sync_state`. C'est **l'ordre** à exécuter (si le serveur dit "PAUSE à 12s", vous mettez en pause à 12s).
    ```javascript
    socket.on("sync_state", (data) => {
       // data = { etat: "PLAY"|"PAUSE", timestamp: 12.5, videoId: "..." }
       // APPLIQUER AU PLAYER YOUTUBE ICI
    });
    ```

3.  **Envoi (Piloter)** : Quand l'utilisateur clique sur Play/Pause/Seek, prévenez le serveur.
    ```javascript
    socket.emit("update_state", {
       codePartage: "XYZ123",
       etat: "PAUSE", // ou "PLAY"
       timestamp: 12.5,
       videoId: "..." // Optionnel si pas changé
    });
    ```

C'est tout ! Le serveur s'occupe de relayer l'info aux autres et de sauvegarder l'état.
