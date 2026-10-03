import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { roomService } from "./room.service";
import { CreateRoomSchema, JoinRoomSchema, RoomCodeParamsSchema, MessageQuerySchema } from "@room5/shared";

export const roomController = {
  async create(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const data = CreateRoomSchema.parse(req.body);
    const room = await roomService.createRoom(data);
    res.status(201).json({ id: room.id, code: room.code });
  },

  async getByCode(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const { code } = RoomCodeParamsSchema.parse(req.params);
    const room = await roomService.getRoomByCode(code);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const isMember = await roomService.verifyActiveMember(room.id, guestId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this room" });
      return;
    }
    res.json(room);
  },

  async join(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const { code } = RoomCodeParamsSchema.parse(req.params);
    const data = JoinRoomSchema.parse(req.body);
    
    try {
      const result = await roomService.joinRoom(guestId, data.code || code);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join room";
      if (message === "Room is full") {
        res.status(409).json({ error: message });
      } else if (message === "Room not found") {
        res.status(404).json({ error: message });
      } else {
        res.status(400).json({ error: message });
      }
    }
  },

  async leave(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const { code } = RoomCodeParamsSchema.parse(req.params);
    await roomService.leaveRoom(guestId, code);
    res.status(204).send();
  },

  async getMembers(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const { code } = RoomCodeParamsSchema.parse(req.params);
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const isMember = await roomService.verifyActiveMember(room.id, guestId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this room" });
      return;
    }
    const members = await roomService.getActiveMembers(code);
    res.json(members);
  },

  async getMessages(req: Request, res: Response) {
    const guestId = req.guest!.id;
    const { code } = RoomCodeParamsSchema.parse(req.params);
    const query = MessageQuerySchema.parse(req.query);
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const isMember = await roomService.verifyActiveMember(room.id, guestId);
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this room" });
      return;
    }
    const result = await roomService.getMessages(room.id, query.limit, query.cursor);
    res.json(result);
  },
};