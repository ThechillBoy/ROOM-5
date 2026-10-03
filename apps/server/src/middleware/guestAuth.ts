import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { Guest } from "@room5/shared";

declare global {
  namespace Express {
    interface Request {
      guest?: Guest & { sessionId: string };
    }
  }
}

export const guestAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionId = req.sessionID;

  if (!sessionId) {
    res.status(401).json({ error: "No session" });
    return;
  }

  const guest = await prisma.guest.findUnique({
    where: { sessionId },
  });

  if (!guest) {
    res.status(401).json({ error: "Guest not found" });
    return;
  }

  req.guest = { ...guest, sessionId };
  next();
};

export const optionalGuestAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const sessionId = req.sessionID;

  if (!sessionId) {
    next();
    return;
  }

  const guest = await prisma.guest.findUnique({
    where: { sessionId },
  });

  if (guest) {
    req.guest = { ...guest, sessionId };
  }

  next();
};