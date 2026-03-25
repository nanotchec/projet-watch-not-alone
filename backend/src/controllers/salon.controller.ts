import { Request, Response } from "express";
import { prisma } from "../prisma";
import bcrypt from 'bcrypt';

export const createSalon = async (req: Request, res: Response) => {
    try {
        const { nom, pseudo } = req.body;

        if (!nom || !pseudo) {
            res.status(400).json({ error: "Nom du salon et pseudo requis" });
            return;
        }

        // pour creer l'utilisateur, le salon et la participation
        const result = await prisma.$transaction(async (tx) => {
            /*const user = await tx.utilisateur.create({
                data: {
                    pseudo,
                    email: `guest_${Date.now()}@example.com`, // Placeholder
                    mot_de_passe_hache: await hashPassword("guest"), // Placeholder
                },
            });*/
            if (!pseudo) {
                res.status(400).json({ error: "Pseudo requis" });
                return;
            }
            try {
                const user = createAccountExec(pseudo,await hashPassword("guest"),`guest_${Date.now()}@example.com`);
            }
            catch (error) {
                console.error("Erreur création de compte :", error);
                res.status(500).json({ error: "Erreur lors de la création du compte" });
            }

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
                    id_participation_hoteID: participation.id_participation,
                },
            });

            // Creer la playlist par defaut du salon
            const playlist = await tx.playlist.create({
                data: {
                    id_salonID: salon.id_salon,
                    id_particiaptionID: participation.id_participation,
                }
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

        // Correction : Utilisation d'une transaction pour tout creer d'un coup (plus sûr)
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.utilisateur.create({
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
        })

        if (!user || !user.mot_de_passe_hache) {
            res.status(401).json({ error: "Mauvais username and/or password incorrect" });
            return;
        }

        const isCorrect = await verifyPassword(password, user.mot_de_passe_hache);
        if (isCorrect) {
            const particip = await prisma.participation.findMany({
                where: {
                    id_utilisateurID: user.id_utilisateur, 
                },
            })
            res.status(200).json({particip})
        }
        else {
            res.status(401).json({ error: "Mauvais username and/or password incorrect"});
        }

    }
    catch (error) {
        console.error("Erreur login :", error);
        res.status(500).json({ error: "Erreur lors de la connection" });
    }
};

export const createAccount = async (req: Request, res: Response) => {
    const {pseudo, password, email} = req.body;
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
    const result = await prisma.$transaction(async (tx) => {
        try {
            createAccountExec(pseudo,password,email);
        }
        catch (error) {
            console.error("Erreur création de compte :", error);
            res.status(500).json({ error: "Erreur lors de la création du compte" });
        }
    }); 
    res.status(201).json(result);
};

async function createAccountExec(pseudo : string, password: string, email: string): Promise<any> {
    // pour creer l'utilisateur
    const user = await tx.utilisateur.create({
        data: {
            pseudo,
            email: `guest_${Date.now()}@example.com`, // Placeholder
            mot_de_passe_hache: await hashPassword(password), // Placeholder
        },
    })
    return {user};
       
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
