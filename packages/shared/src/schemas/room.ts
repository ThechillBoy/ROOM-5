import { z } from "zod";
import { ROOM_CODE_LENGTH, ROOM_MAX_MEMBERS, ROOM_CODE_REGEX } from "../constants/index.js";

export const RoomSchema = z.object({
  id: z.string().cuid(),
  code: z.string().length(ROOM_CODE_LENGTH).regex(ROOM_CODE_REGEX),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RoomMemberSchema = z.object({
  id: z.string().cuid(),
  guestId: z.string(),
  roomId: z.string(),
  joinedAt: z.date(),
  leftAt: z.date().nullable(),
});

export const CreateRoomSchema = z.object({});

export const JoinRoomSchema = z.object({
  code: z.string().length(ROOM_CODE_LENGTH).regex(ROOM_CODE_REGEX),
});

export const RoomParamsSchema = z.object({
  id: z.string().cuid(),
});

export const RoomCodeParamsSchema = z.object({
  code: z.string().length(ROOM_CODE_LENGTH).regex(ROOM_CODE_REGEX),
});

export type Room = z.infer<typeof RoomSchema>;
export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type RoomParams = z.infer<typeof RoomParamsSchema>;
export type RoomCodeParams = z.infer<typeof RoomCodeParamsSchema>;