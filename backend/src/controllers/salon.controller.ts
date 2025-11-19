import { Request, Response } from "express";
import { prisma } from "../prisma";

export const createSalon = async (req: Request, res: Response) => {
    try {
        const { nom, pseudo } = req.body;

        if (!nom || !pseudo) {
            res.status(400).json({ error: "Nom du salon et pseudo requis" });
            return;
        }

        // pour creer l'utilisateur, le salon et la participation
        const result = await prisma.$transaction(async (tx) => {
            // Créer l'utilisateur (invité pour l'instant)
            const user = await tx.utilisateur.create({
                data: {
                    pseudo,
                    email: `guest_${Date.now()}@example.com`, // Placeholder
                    mot_de_passe_hache: "guest", // Placeholder
                },
            });

            // Creer la participation
            const participation = await tx.participation.create({
                data: {
                    pseudo,
                    role: "HOST",
                    ip: req.ip || "127.0.0.1",
                    id_utilisateurID: user.id_utilisateur,
                },
            });

            // Creer le salon
            const codePartage = Math.random().toString(36).substring(2, 8).toUpperCase();
            const salon = await tx.salon.create({
                data: {
                    nom,
                    code_partage: codePartage,
                    etat_lecture: "PAUSE",
                    fournisseur: "YOUTUBE",
                    video_id: "",
                    horodatage_sec: 0,
                    id_participation_hoteID: participation.id_participation,
                },
            });

            return { salon, user, participation };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Erreur création salon:", error);
        res.status(500).json({ error: "Erreur lors de la création du salon" });
    }
};

export const joinSalon = async (req: Request, res: Response) => {
    try {
        const { codePartage, pseudo } = req.body;

        if (!codePartage || !pseudo) {
            res.status(400).json({ error: "code partage du salon et pseudo requis" });
            return;
        }

        // get info salon 
        const salon = await prisma.salon.findFirst({
            where: {
                code_partage: codePartage,
            },
        });

        // maj le salon (rajout participation?)
        //#TODO:
        res.status(201).json(salon);
    } catch (error) {
        console.error("Erreur jion salon:", error);
        res.status(500).json({ error: "Erreur lors de connexion au salon" });
    }
};
