import "dotenv/config";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { env } from "./config/env";
import { sessionMiddleware, connectSessionStore, closeSessionStore } from "./config/session";
import { createSocketAuthMiddleware } from "./socket/socket.auth";
import { setupRoomHandlers } from "./socket/handlers";

const httpServer = http.createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

io.use(createSocketAuthMiddleware(sessionMiddleware));

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id} (guest: ${socket.data.guest?.name})`);

  setupRoomHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} - ${reason}`);
  });
});

const PORT = env.PORT;
let shuttingDown = false;

async function startServer(): Promise<void> {
  try {
    await connectSessionStore();
    if (shuttingDown) return;

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch {
    if (shuttingDown) return;
    console.error("Unable to start Room5: session store initialization failed");
    await closeSessionStore();
    process.exitCode = 1;
  }
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);
  // Socket.IO closes its transports and the attached HTTP server first.
  io.close(async () => {
    try {
      await closeSessionStore();
      console.log("Server closed");
      process.exit(0);
    } catch {
      console.error("Session store shutdown failed");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

void startServer();
