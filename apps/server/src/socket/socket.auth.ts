import { Server as SocketIOServer, Socket } from "socket.io";
import { Session } from "express-session";
import { prisma } from "../config/db";
import { Guest } from "@room5/shared";

declare module "socket.io" {
  interface SocketData {
    guest?: Guest & { sessionId: string };
    sessionId?: string;
  }
}

export function createSocketAuthMiddleware(sessionMiddleware: any) {
  return (socket: Socket, next: (err?: Error) => void) => {
    const req = socket.request as any;
    const res = { setHeader: () => {}, getHeader: () => {} } as any;

    sessionMiddleware(req, res, async (err: Error | undefined) => {
      if (err) {
        return next(new Error("Session error"));
      }

      const sessionId = req.sessionID;
      if (!sessionId) {
        return next(new Error("No session"));
      }

      socket.data.sessionId = sessionId;

      const guest = await prisma.guest.findUnique({
        where: { sessionId },
      });

      if (!guest) {
        return next(new Error("Guest not found"));
      }

      socket.data.guest = { ...guest, sessionId };
      next();
    });
  };
}