import { Server, Socket } from "socket.io";
import { prisma } from "../prisma";

interface JoinPayload {
    codePartage: string;
    pseudo: string;
}

interface StatePayload {
    codePartage: string;
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

export const setupSalonSockets = (io: Server) => {
    io.on("connection", (socket: Socket) => {

        // Rejoindre un salon
        socket.on("join_salon", async ({ codePartage, pseudo }: JoinPayload) => {
            // 1. Récupérer le salon
            const salon = await prisma.salon.findFirst({
                where: { code_partage: codePartage },
            });

            if (!salon) {
                socket.emit("error", "Salon introuvable");
                return;
            }

            // 2. Rejoindre la room Socket.IO
            const roomName = `salon_${codePartage}`;
            socket.join(roomName);
            console.log(`User ${pseudo} joined room ${roomName}`);

            // 3. Envoyer l'état actuel (SYNC à l'arrivée)
            socket.emit("sync_state", {
                etat: salon.etat_lecture,
                timestamp: salon.horodatage_sec,
                videoId: salon.video_id,
                fournisseur: salon.fournisseur,
            });

            // 4. Notifier les autres
            socket.to(roomName).emit("user_joined", { pseudo });
        });

        //MAJ chat
        socket.on("update_message", async (message: MessageCont) => {
            const { codePartage, contenu, cree, user} = message;
            const roomName = `salon_${codePartage}`;
            const participe = await prisma.participation.findFirst({
                where: {
                    id_salonID: `salon_$.id_salon`,
                    pseudo: user,
                },
            });

            // Sauvegarde en BDD
            try {
                await prisma.$transaction(async (tx) => {
                const messages = await tx.message.create({
                    data: {
                        id_participationID: participe.id_participation,
                        contenu: message,
                        cree_le: cree,
                    },
                })});

                // Broadcast aux autres (sauf l'émetteur)
                socket.to(roomName).emit("chat_update", {
                    message,
                    user,
                    contenu,
                    cree,
                });
            }
            catch (error) {
                console.error("Erreur register message:", error);
            }
        });

        // Mise à jour état (PLAY/PAUSE/SEEK)
        socket.on("update_state", async (payload: StatePayload) => {
            const { codePartage, etat, timestamp, videoId } = payload;
            const roomName = `salon_${codePartage}`;

            // Sauvegarde en BDD
            try {
                await prisma.salon.updateMany({
                    where: { code_partage: codePartage },
                    data: {
                        etat_lecture: etat,
                        horodatage_sec: timestamp,
                        ...(videoId && { video_id: videoId }) // Mise à jour video_id si présent
                    }
                });

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

        socket.on("disconnect", () => {
            // Gérer déconnexion si besoin
        });
    });
};
