import { Router } from "express";
import { createSalon, joinSalon } from "../controllers/salon.controller";

const router = Router();

router.post("/", createSalon);
router.post("/join/", joinSalon)

export default router;
