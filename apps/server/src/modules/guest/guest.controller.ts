import { Request, Response } from "express";
import { guestService } from "./guest.service";
import { CreateGuestSchema, UpdateGuestSchema } from "@room5/shared";

export const guestController = {
  async createOrGet(req: Request, res: Response) {
    const sessionId = req.sessionID!;
    const data = CreateGuestSchema.parse(req.body);
    const guest = await guestService.createOrGetGuest(sessionId, data);
    res.status(201).json(guest);
  },

  async get(req: Request, res: Response) {
    const sessionId = req.sessionID!;
    const guest = await guestService.getGuest(sessionId);

    if (!guest) {
      res.status(404).json({ error: "Guest not found" });
      return;
    }

    res.json(guest);
  },

  async update(req: Request, res: Response) {
    const sessionId = req.sessionID!;
    const data = UpdateGuestSchema.parse(req.body);
    const guest = await guestService.updateGuest(sessionId, data);
    res.json(guest);
  },
};