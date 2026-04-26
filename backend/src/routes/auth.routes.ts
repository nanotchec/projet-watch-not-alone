import { Router } from "express";
import { login, createAccount, getMesSalons } from "../controllers/salon.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", createAccount);
router.get("/mes-salons", authenticateJWT, getMesSalons);

export default router;
