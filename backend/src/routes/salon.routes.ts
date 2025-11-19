import { Router } from "express";
import { createSalon } from "../controllers/salon.controller";

const router = Router();

router.post("/", createSalon);

export default router;
