import { Router } from "express";
import { createSalon, getSalonParticipants, joinSalon, reconnectSalon } from "../controllers/salon.controller";

const router = Router();

router.post("/", createSalon);
router.post("/join/", joinSalon)
router.post("/reconnect", reconnectSalon)
router.get("/:codePartage/participants", getSalonParticipants)

export default router;
