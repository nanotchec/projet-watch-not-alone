import { Request, Response } from "express";
import { prisma } from "../prisma";
import bcrypt from 'bcrypt';
import { Prisma, Utilisateur, Salon, Participation, Message, Playlist } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../env";



export const createSalon = async (req: Request, res: Response) => {
    try {
        const { nom, pseudo } = req.body;

        if (!nom || !pseudo) {
            res.status(400).json({ error: "Nom du salon et pseudo requis" });
            return;
        }

        let authUser = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, env.jwtSecret) as { id_utilisateur: number };
                authUser = await prisma.utilisateur.findUnique({ where: { id_utilisateur: decoded.id_utilisateur } });
            } catch (e) {
                console.log("Token invalide ou expiré, création d'un compte invité");
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const user = authUser || await createAccountExec(tx, pseudo, "guest", `guest_${Date.now()}@example.com`);
            const participation = await createParticipationExec(tx, user, pseudo, req.ip || "127.0.0.1");
            const salon = await createSalonExec(tx, participation, nom);
            await createPlaylistExec(tx, salon, participation);
            return { salon, user, participation: { ...participation, id_salonID: salon.id_salon } };
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

        // Correction : vérifier si 'salon' est null avant d'accéder 
        if (!salon) {
            res.status(404).json({ error: "le salon n'existe pas" });
            return;
        }

        // vérification Ban IP
        const userIp = req.ip || "127.0.0.1";
        const isBanned = await prisma.banIp.findFirst({
            where: {
                id_salonID: salon.id_salon,
                ip: userIp,
                expire_le: {
                    gt: new Date(), // expire_le > maintenant
                },
            },
        });

        if (isBanned) {
            res.status(403).json({ error: "Accès refusé : Vous êtes banni de ce salon." });
            return;
        }

        // vérification pseudo unique
        const pseudoPris = await prisma.participation.findFirst({
            where: {
                id_salonID: salon.id_salon,
                pseudo: pseudo,
            },
        });

        if (pseudoPris) {
            res.status(409).json({ error: "Ce pseudo est déjà utilisé dans ce salon." });
            return;
        }

        let authUser = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, env.jwtSecret) as { id_utilisateur: number };
                authUser = await prisma.utilisateur.findUnique({ where: { id_utilisateur: decoded.id_utilisateur } });
            } catch (e) {
                console.log("Token invalide ou expiré, création d'un compte invité");
            }
        }

        // Correction : Utilisation d'une transaction pour tout creer d'un coup (plus sûr)
        const result = await prisma.$transaction(async (tx) => {
            const user = authUser || await tx.utilisateur.create({
                data: {
                    pseudo,
                    email: `guest_${Date.now()}@example.com`, // Placeholder
                    mot_de_passe_hache: await hashPassword("guest"), // Placeholder
                },
            });

            const participation = await tx.participation.create({
                data: {
                    pseudo,
                    role: "MEMBER", // Correction : On rejoint en tant que membre, pas HOST
                    ip: req.ip || "127.0.0.1",
                    id_utilisateurID: user.id_utilisateur,
                    id_salonID: salon.id_salon // Correction : Liaison directe au salon
                },
            });

            return { salon, user, participation };
        });

        res.status(201).json(result);
    } catch (error) {
        console.error("Erreur join salon:", error);
        res.status(500).json({ error: "Erreur lors de connexion au salon" });
    }
};

export const reconnectSalon = async (req: Request, res: Response) => {
    try {
        const { pseudo, password } = req.body;

        if (!pseudo || !password) {
            res.status(400).json({ error: "Pseudo et mot de passe requis" });
            return;
        }

        const plainPassword = String(password);
        if (plainPassword !== "guest" && plainPassword !== "test") {
            res.status(401).json({ error: "Mot de passe invalide (utilisez guest ou test en minuscule)" });
            return;
        }

        const user = await prisma.utilisateur.findFirst({
            where: { pseudo },
            orderBy: { id_utilisateur: "desc" },
        });

        if (!user || !user.mot_de_passe_hache) {
            res.status(404).json({ error: "Utilisateur introuvable" });
            return;
        }

        const isCorrect = await verifyPassword(plainPassword, user.mot_de_passe_hache);
        if (!isCorrect) {
            res.status(401).json({ error: "Pseudo ou mot de passe incorrect" });
            return;
        }

        const participation = await prisma.participation.findFirst({
            where: {
                id_utilisateurID: user.id_utilisateur,
                id_salonID: { not: null },
            },
            include: {
                id_salon: true,
            },
            orderBy: {
                rejoint_le: "desc",
            },
        });

        if (!participation || !participation.id_salon) {
            res.status(404).json({ error: "Aucun salon trouvé pour cet utilisateur" });
            return;
        }

        res.status(200).json({
            user: {
                pseudo: user.pseudo,
            },
            salon: {
                nom: participation.id_salon.nom,
                code_partage: participation.id_salon.code_partage,
            },
            participation: {
                role: participation.role,
            },
        });
    } catch (error) {
        console.error("Erreur reconnexion salon:", error);
        res.status(500).json({ error: "Erreur lors de la reconnexion" });
    }
};

export const getSalonParticipants = async (req: Request, res: Response) => {
    try {
        const rawCodePartage = req.params.codePartage;
        const codePartage = Array.isArray(rawCodePartage) ? rawCodePartage[0] : rawCodePartage;

        if (!codePartage) {
            res.status(400).json({ error: "Code salon requis" });
            return;
        }

        const salon = await prisma.salon.findFirst({
            where: { code_partage: codePartage },
        });

        if (!salon) {
            res.status(404).json({ error: "Salon introuvable" });
            return;
        }

        const participants = await prisma.participation.findMany({
            where: {
                id_salonID: salon.id_salon,
            },
            select: {
                pseudo: true,
                role: true,
            },
            orderBy: {
                rejoint_le: "asc",
            },
        });

        res.status(200).json({ participants });
    } catch (error) {
        console.error("Erreur récupération participants:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des participants" });
    }
};

export const createMessage = async (req: Request, res: Response) => {
    try {
        const { message, pseudo, codePartage } = req.body;

        if (!message || !pseudo || !codePartage) {
            res.status(400).json({ error: "Données incomplètes" });
            return;
        }

        const salon = await prisma.salon.findFirst({
            where: {
                code_partage: codePartage,
            },
        });

        if (!salon) {
            res.status(404).json({ error: "Salon introuvable" });
            return;
        }

        const qui = await prisma.participation.findFirst({
            where: {
                id_salonID: salon.id_salon,
                pseudo: pseudo,
            },
        });

        if (!qui) {
            res.status(403).json({ error: "Vous ne participez pas à ce salon" });
            return;
        }

        const result = await prisma.message.create({
            data: {
                id_ParticipationID: qui.id_participation,
                contenu: message,
                type: "TEXT",
            },
        });

        res.status(201).json(result);
    }
    catch (error) {
        console.error("Erreur register message:", error);
        res.status(500).json({ error: "Erreur lors de la prise en compte du message" });
    }
};

//  @TODO: need code review

export const login = async (req: Request, res: Response) => {
    try {
        const { pseudo, password } = req.body;
        const user = await prisma.utilisateur.findFirst({
            where: {
                pseudo: pseudo,
            },
        });

        if (!user || !user.mot_de_passe_hache) {
            res.status(401).json({ error: "Pseudo et/ou mot de passe requis" });
            return;
        }

        const isCorrect = await verifyPassword(password, user.mot_de_passe_hache);
        if (isCorrect) {
            const token = jwt.sign(
                { id_utilisateur: user.id_utilisateur, pseudo: user.pseudo },
                env.jwtSecret,
                { expiresIn: "7d" }
            );
            res.status(200).json({ 
                token, 
                user: { id_utilisateur: user.id_utilisateur, pseudo: user.pseudo, email: user.email } 
            });
        }
        else {
            res.status(401).json({ error: "Pseudo ou mot de passe incorrect" });
        }
    }
    catch (error) {
        console.error("Erreur login :", error);
        res.status(500).json({ error: "Erreur lors de la connexion" });
    }
};

export const createAccount = async (req: Request, res: Response) => {
    const { pseudo, password, email } = req.body;
    if (!pseudo || !password || !email) {
        res.status(400).json({ error: "Pseudo, mot de passe et email requis" });
        return;
    }
    const pseudoPris = await prisma.utilisateur.findFirst({
        where: {
            pseudo: pseudo,
        },
    });
    if (pseudoPris) {
        res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
        return;
    }
    try {
        const result = await prisma.$transaction(async (tx) => {
            return await createAccountExec(tx, pseudo, password, email);
        }); 

        const token = jwt.sign(
            { id_utilisateur: result.id_utilisateur, pseudo: result.pseudo },
            env.jwtSecret,
            { expiresIn: "7d" }
        );

        res.status(201).json({ 
            token, 
            user: { id_utilisateur: result.id_utilisateur, pseudo: result.pseudo, email: result.email } 
        });
    } catch (error) {
        console.error("Erreur création de compte :", error);
        res.status(500).json({ error: "Erreur lors de la création du compte" });
    }
};

export const getMesSalons = async (req: Request, res: Response) => {
    try {
        // Le middleware authenticateJWT a attaché l'utilisateur à req.user
        const userId = (req as any).user.id_utilisateur;

        const user = await prisma.utilisateur.findUnique({
            where: { id_utilisateur: userId }
        });

        if (!user) {
            res.status(404).json({ error: "Utilisateur non trouvé" });
            return;
        }

        const salons = await getSalonParticpePasse(prisma, user);
        res.status(200).json({ salons });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique :", error);
        res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
    }
};

async function createAccountExec(tx: Prisma.TransactionClient, pseudo : string, password: string, email: string): Promise<Utilisateur> {
    // pour creer l'utilisateur
    const user = await tx.utilisateur.create({
        data: {
            pseudo,
            email,
            mot_de_passe_hache: await hashPassword(password),
        },
    });
    return user;
}

async function createParticipationExec(tx: Prisma.TransactionClient, user: Utilisateur, pseudo: string, ip: string): Promise<Participation> {
    // Creer la participation
    const participation = await tx.participation.create({
        data: {
            pseudo: pseudo,
            role: "HOST",
            ip: ip,
            id_utilisateurID: user.id_utilisateur,
        },
    });
    return participation;
}

async function createSalonExec(tx: Prisma.TransactionClient, participation: Participation, nom: string): Promise<Salon> {
    // Creer le salon
    const codePartage = Math.random().toString(36).substring(2, 8).toUpperCase();
    const salon = await tx.salon.create({
        data: {
            nom,
            code_partage: codePartage,
            id_participation_hoteID: participation.id_participation,
        },
    });
    
    // lier participation au salon
    await tx.participation.update({
        where: { id_participation: participation.id_participation },
        data: {
            id_salon: {
                connect: { id_salon: salon.id_salon }
            }
        },
    });
    return salon;
}

async function createPlaylistExec(tx: Prisma.TransactionClient, salon: Salon, participation: Participation): Promise<Playlist> {
    // Creer la playlist par defaut du salon
    const playlist = await tx.playlist.create({
        data: {
            id_salonID: salon.id_salon,
            id_particiaptionID: participation.id_participation,
        }
    });
    return playlist;
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10; // Adjust as needed for security/performance
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
}

async function getSalonParticpePasse(tx: Prisma.TransactionClient, user: Utilisateur): Promise<Salon[]> {
    const participations = await tx.participation.findMany({
        where: {
            id_utilisateurID: user.id_utilisateur,
        }
    });
    const salonIds = participations
        .map((p) => p.id_salonID)
        .filter((id): id is number => id !== null);

    const salons = await tx.salon.findMany({
        where: {
            id_salon: { in: salonIds },
        }
    });
    return salons;
}
