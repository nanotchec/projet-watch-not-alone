import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

export interface AuthRequest extends Request {
    user?: {
        id_utilisateur: number;
        pseudo: string;
    };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, env.jwtSecret, (err, user) => {
            if (err) {
                return res.status(403).json({ error: "Token invalide ou expiré" });
            }

            req.user = user as { id_utilisateur: number; pseudo: string };
            next();
        });
    } else {
        res.status(401).json({ error: "Authentification requise" });
    }
};
