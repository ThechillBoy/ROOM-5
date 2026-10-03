import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "../constants/index.js";

export const MessageSchema = z.object({
  id: z.string().cuid(),
  roomId: z.string().cuid(),
  guestId: z.string().cuid(),
  content: z.string().min(1).max(MESSAGE_MAX_LENGTH),
  createdAt: z.date(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(MESSAGE_MAX_LENGTH).trim(),
});

export const MessageParamsSchema = z.object({
  id: z.string().cuid(),
});

export const MessageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type MessageParams = z.infer<typeof MessageParamsSchema>;
export type MessageQuery = z.infer<typeof MessageQuerySchema>;

export const MessageWithGuestSchema = MessageSchema.extend({
  guest: z.object({
    id: z.string().cuid(),
    name: z.string(),
    avatar: z.string(),
  }),
});

export type MessageWithGuest = z.infer<typeof MessageWithGuestSchema>;