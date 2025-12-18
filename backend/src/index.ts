import http from "http";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

import { env } from "./env";
import { prisma } from "./prisma";

import salonRoutes from "./routes/salon.routes";

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : "*",
    },
  });

  app.use(cors({ origin: env.corsOrigins.length > 0 ? env.corsOrigins : "*" }));
  app.use(express.json());

  app.use("/salon", salonRoutes);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, environment: env.nodeEnv });
  });

  io.on("connection", (socket) => {
    console.log(`Socket connecté: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`Socket déconnecté (${socket.id}) : ${reason}`);
    });
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
