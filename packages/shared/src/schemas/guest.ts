import { z } from "zod";
import { GUEST_NAME_MAX, GUEST_AVATAR_MAX } from "../constants/index.js";

export const GuestSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(GUEST_NAME_MAX),
  avatar: z.string().min(1).max(GUEST_AVATAR_MAX),
  sessionId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateGuestSchema = z.object({
  name: z.string().min(1).max(GUEST_NAME_MAX).trim(),
  avatar: z.string().min(1).max(GUEST_AVATAR_MAX).trim(),
});

export const UpdateGuestSchema = z.object({
  name: z.string().min(1).max(GUEST_NAME_MAX).trim().optional(),
  avatar: z.string().min(1).max(GUEST_AVATAR_MAX).trim().optional(),
}).refine((data) => data.name !== undefined || data.avatar !== undefined, {
  message: "At least one field (name or avatar) must be provided",
});

export type Guest = z.infer<typeof GuestSchema>;
export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;