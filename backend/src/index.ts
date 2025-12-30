import http from "http";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

import { env } from "./env";
import { prisma } from "./prisma";

import salonRoutes from "./routes/salon.routes";
import { setupSalonSockets } from "./sockets/salon.handler";

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Autoriser tout pour socket.io en dev pour éviter les problèmes
    },
  });

  // Autoriser explicitement les ports frontends courants si l'environnement est restrictif, ou par défaut *
  const allowedOrigins = [
    ...env.corsOrigins,
    "http://localhost:5173",
    "http://localhost:4173"
  ].filter(Boolean);

  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*"
  }));
  app.use(express.json());

  app.use("/salon", salonRoutes);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, environment: env.nodeEnv });
  });

  setupSalonSockets(io);

  // Log de connexion basique fourni par le handler ou supprimer si redondant
  io.engine.on("connection_error", (err) => {
    console.log(err.req);      // l'objet requête
    console.log(err.code);     // le code d'erreur, par exemple 1
    console.log(err.message);  // le message d'erreur, par exemple "Session ID unknown"
    console.log(err.context);  // contexte d'erreur supplémentaire
  });

  server.listen(env.port, () => {
    console.log(`Serveur backend prêt sur http://localhost:${env.port}`);
    console.log(`CORS origins allowed: ${env.corsOrigins.length > 0 ? env.corsOrigins.join(', ') : '*'}`);
  });
}

main().catch((error) => {
  console.error("Erreur de démarrage du serveur:", error);
  prisma.$disconnect().finally(() => process.exit(1));
});
