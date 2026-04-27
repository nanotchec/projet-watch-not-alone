import { Server, Socket } from "socket.io";
import { prisma } from "../prisma";

interface JoinPayload {
    codePartage: string;
    pseudo: string;
}

interface StatePayload {
    codePartage: string;
    pseudo: string;
    etat: "PLAY" | "PAUSE";
    timestamp: number;
    videoId?: string;
}

interface MessageCont {
    codePartage: string;
    contenu: string;
    cree: Date;
    user: string;
}

interface AddStreamPayload {
    codePartage: string;
    pseudo: string;
    fournisseur: string;
    videoId: string;
}

interface SetMainStreamPayload {
    codePartage: string;
    pseudo: string;
    elementPlaylistId: number;
}

interface ChangeModePayload {
    codePartage: string;
    pseudo: string;
    mode: "STANDARD" | "SPORTS_ANALYSIS";
}

interface AddAnnotationPayload {
    codePartage: string;
    pseudo: string;
    id_angle: number | null;
    timestamp_video: number;
    duree_affichage?: number;
    type: string;
    payload: any;
}

interface MainStreamChangedPayload {
    elementPlaylistId: number;
    videoId?: string;
    fournisseur?: string;
    angles: {
        id_angle: number;
        nom: string;
        fournisseur: string;
        video_id: string;
    }[];
}

export const setupSalonSockets = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        let roomName = "";
        // Rejoindre un salon
        socket.on("join_salon", async ({ codePartage, pseudo }: JoinPayload) => {
            // 1. Récupérer le salon et sa playlist active
            const salon = await prisma.salon.findFirst({
                where: { code_partage: codePartage },
                include: {
                    id_playlist: {
                        include: {
                            id_element_playlist: true
                        }
                    },
                    element_principal: {
                        include: {
                            angles: true
                        }
                    },
                }
            });

            if (!salon) {
                socket.emit("error", "Salon introuvable");
                return;
            }

            // 2. Rejoindre la room Socket.IO
            roomName = `salon_${codePartage}`;
            socket.join(roomName);
            console.log(`User ${pseudo} joined room ${roomName}, nombre de participant actif : ${io.of("/").adapter.rooms.get(roomName)?.size || 0}`);

            // 3. Envoyer l'état actuel (SYNC à l'arrivée)
            let currentTimestamp = 0;
            let currentEtat = "PAUSE";
            let currentVideoId = "";
            let currentFournisseur = "YOUTUBE";

            // Si on utilise le flux principal via la playlist
            if (salon.element_principal) {
                currentTimestamp = salon.element_principal.horodatage_sec;
                currentEtat = salon.element_principal.etat_lecture;
                currentVideoId = salon.element_principal.video_id;
                currentFournisseur = salon.element_principal.fournisseur;
            }

            if (currentEtat === "PLAY" && salon.element_principal) {
                const now = new Date();
                const elapsedSeconds = (now.getTime() - salon.maj_etat_le.getTime()) / 1000;
                currentTimestamp += elapsedSeconds;
            }

            const participation = await prisma.participation.findFirst({
                where: {
                    id_salonID: salon.id_salon,
                    pseudo: pseudo
                }
            });

            socket.emit("sync_state", {
                etat: currentEtat,
                timestamp: currentTimestamp,
                videoId: currentVideoId,
                fournisseur: currentFournisseur,
                // Nouveau pour le multiflux
                playlist: salon.id_playlist?.id_element_playlist || [],
                activeElementId: salon.id_element_principalID,
                mode: salon.mode,
                angles: salon.element_principal?.angles || [],
                role: participation?.role,
            });

            // 4. Notifier les autres
            socket.to(roomName).emit("user_joined", { pseudo });
            const num_participe = io.of("/").adapter.rooms.get(roomName)?.size || 0;
            socket.to(roomName).emit("user_count", { num_participe });
        });

        //MAJ chat
        // MAJ chat
        socket.on("update_message", async (message: MessageCont) => {
            const { codePartage, contenu, cree, user } = message;
            const roomName = `salon_${codePartage}`;

            try {
                // 1. D'abord on récupère le salon pour avoir son ID
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage }
                });

                if (!salon) {
                    console.error("Salon introuvable pour le message");
                    return;
                }

                // 2. On récupère la participation
                const participe = await prisma.participation.findFirst({
                    where: {
                        id_salonID: salon.id_salon,
                        pseudo: user,
                    },
                });

                if (!participe) {
                    console.error("Participation introuvable pour le message");
                    return;
                }

                // 3. Sauvegarde en BDD
                await prisma.message.create({
                    data: {
                        id_ParticipationID: participe.id_participation,
                        contenu: contenu,
                        type: "TEXT",
                        cree_le: cree,
                    },
                });

                // 4. Broadcast aux autres (sauf l'émetteur)
                socket.to(roomName).emit("chat_update", {
                    message,
                    user,
                    contenu,
                    cree,
                });
            } catch (error) {
                console.error("Erreur register message:", error);
            }
        });

        // Mise à jour état (PLAY/PAUSE/SEEK)
        socket.on("update_state", async (payload: StatePayload) => {
            const { codePartage, pseudo, etat, timestamp, videoId } = payload;
            const roomName = `salon_${codePartage}`;

            try {
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage }
                });

                if (!salon) return;

                const participe = await prisma.participation.findFirst({
                    where: { id_salonID: salon.id_salon, pseudo }
                });

                // Si pas membre, ou pas HOST => bloqué
                if (!participe || participe.role !== "HOST") {
                    socket.emit("error", "Seul l'hôte peut modifier l'état de lecture.");
                    return;
                }

                if (salon.id_element_principalID) {
                    await prisma.elementPlaylist.update({
                        where: { id_element_playlist: salon.id_element_principalID },
                        data: {
                            etat_lecture: etat,
                            horodatage_sec: timestamp,
                            ...(videoId && { video_id: videoId }) // Update only if present
                        }
                    });
                }
                // Si on a pas d'élément principal, on ignore la requête de state pour l'instant

                // Broadcast aux autres (sauf l'émetteur)
                socket.to(roomName).emit("sync_state", {
                    etat,
                    timestamp,
                    videoId,
                });

            } catch (e) {
                console.error("Erreur update state", e);
            }
        });

        socket.on("disconnecting", () => {
            // the rooms array contains at least the socket ID
            const num_participe = io.of("/").adapter.rooms.get(roomName)?.size || 0;
            socket.to(roomName).emit("user_count", { num_participe });
        });

        socket.on("disconnect", () => {
            // Gérer déconnexion si besoin
        });

        // ==========================================
        // MULTI-STREAM LOGIC (OPTION B)
        // ==========================================

        // 1. Ajouter un flux à la playlist du salon
        socket.on("add_stream_to_playlist", async (payload: AddStreamPayload) => {
            const { codePartage, pseudo, fournisseur, videoId } = payload;
            const roomName = `salon_${codePartage}`;

            try {
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage },
                    include: { id_playlist: true }
                });

                if (!salon || !salon.id_playlist) return;

                const participe = await prisma.participation.findFirst({
                    where: { id_salonID: salon.id_salon, pseudo }
                });

                // Seul le HOST peut ajouter à la playlist
                if (!participe || participe.role !== "HOST") {
                    socket.emit("error", "Seul l'hôte peut ajouter des éléments à la playlist.");
                    return;
                }

                const newElement = await prisma.elementPlaylist.create({
                    data: {
                        id_playlistID: salon.id_playlist.id_playlist,
                        fournisseur: fournisseur,
                        video_id: videoId,
                        position: 0, // A gérer si besoin d'ordre avec count
                        ajoutee_parID: participe.id_participation,
                    }
                });

                // Broadcast à tout le monde que le flux a été ajouté
                io.to(roomName).emit("stream_added", newElement);
            } catch (err) {
                console.error("Erreur add_stream_to_playlist", err);
            }
        });

        // 2. Changer le flux principal (réservé au HOST)
        socket.on("set_main_stream", async (payload: SetMainStreamPayload) => {
            const { codePartage, pseudo, elementPlaylistId } = payload;
            const roomName = `salon_${codePartage}`;

            try {
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage }
                });

                if (!salon) return;

                const participe = await prisma.participation.findFirst({
                    where: { id_salonID: salon.id_salon, pseudo }
                });

                // Si pas membre, ou pas HOST => bloqué
                if (!participe || participe.role !== "HOST") {
                    socket.emit("error", "Vous n'avez pas l'autorisation de changer le flux principal.");
                    return;
                }

                // Maj la BDD pour pointer le nouveau flux principal
                await prisma.salon.update({
                    where: { id_salon: salon.id_salon },
                    data: {
                        id_element_principalID: elementPlaylistId
                    }
                });

                // Optionnel : récupérer le flux pour broadcast play
                const element = await prisma.elementPlaylist.findUnique({
                    where: { id_element_playlist: elementPlaylistId },
                    include: { angles: true }
                });

                const mainStreamPayload: MainStreamChangedPayload = {
                    elementPlaylistId,
                    videoId: element?.video_id,
                    fournisseur: element?.fournisseur,
                    angles: element?.angles || []
                };

                io.to(roomName).emit("main_stream_changed", mainStreamPayload);
            } catch (err) {
                console.error("Erreur set_main_stream", err);
            }
        });

        // 3. Basculer le mode du salon (réservé au HOST)
        socket.on("change_room_mode", async (payload: ChangeModePayload) => {
            const { codePartage, pseudo, mode } = payload;
            const roomName = `salon_${codePartage}`;

            try {
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage },
                    include: {
                        element_principal: {
                            include: { angles: true }
                        }
                    }
                });

                if (!salon) return;

                const participe = await prisma.participation.findFirst({
                    where: { id_salonID: salon.id_salon, pseudo }
                });

                if (!participe || participe.role !== "HOST") {
                    socket.emit("error", "Seul l'hôte peut modifier le mode du salon.");
                    return;
                }

                await prisma.salon.update({
                    where: { id_salon: salon.id_salon },
                    data: { mode }
                });

                io.to(roomName).emit("room_mode_changed", {
                    mode,
                    angles: salon.element_principal?.angles || []
                });
            } catch (err) {
                console.error("Erreur change_room_mode", err);
            }
        });

        // 4. Ajouter une annotation
        socket.on("add_annotation", async (payload: AddAnnotationPayload) => {
            const { codePartage, pseudo, id_angle, timestamp_video, duree_affichage, type, payload: annotationPayload } = payload;
            const roomName = `salon_${codePartage}`;

            try {
                const salon = await prisma.salon.findFirst({
                    where: { code_partage: codePartage }
                });

                if (!salon) return;

                const participe = await prisma.participation.findFirst({
                    where: { id_salonID: salon.id_salon, pseudo }
                });

                if (!participe) return;

                if (id_angle !== null) {
                    const angle = await prisma.elementPlaylistAngle.findFirst({
                        where: {
                            id_angle,
                            element_playlist: {
                                id_playlist: {
                                    id_salonID: salon.id_salon
                                }
                            }
                        }
                    });

                    if (!angle) {
                        socket.emit("error", "Angle invalide pour ce salon.");
                        return;
                    }
                }

                const newAnnotation = await prisma.annotation.create({
                    data: {
                        id_salon: salon.id_salon,
                        id_participation: participe.id_participation,
                        id_angle,
                        timestamp_video: timestamp_video,
                        duree_affichage: duree_affichage ?? null,
                        type: type,
                        payload: annotationPayload
                    }
                });

                io.to(roomName).emit("new_annotation", newAnnotation);
            } catch (err) {
                console.error("Erreur add_annotation", err);
            }
        });
    });
};
