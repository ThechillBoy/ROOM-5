import { prisma } from "../../config/db";
import { CreateGuestInput, Guest, UpdateGuestInput } from "@room5/shared";

export const guestService = {
  async createOrGetGuest(sessionId: string, data: CreateGuestInput): Promise<Guest> {
    const existing = await prisma.guest.findUnique({ where: { sessionId } });

    if (existing) {
      return prisma.guest.update({
        where: { sessionId },
        data: { name: data.name, avatar: data.avatar },
      });
    }

    return prisma.guest.create({
      data: {
        sessionId,
        name: data.name,
        avatar: data.avatar,
      },
    });
  },

  async getGuest(sessionId: string): Promise<Guest | null> {
    return prisma.guest.findUnique({ where: { sessionId } });
  },

  async updateGuest(sessionId: string, data: UpdateGuestInput): Promise<Guest> {
    return prisma.guest.update({
      where: { sessionId },
      data,
    });
  },
};