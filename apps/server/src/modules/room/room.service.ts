import { prisma } from "../../config/db";
import { CreateRoomInput, JoinRoomInput, Room, RoomMember, Message } from "@room5/shared";
import { randomBytes } from "crypto";
import { ROOM_CODE_LENGTH, ROOM_MAX_MEMBERS, ROOM_CODE_REGEX, MESSAGE_MAX_LENGTH } from "@room5/shared";

function generateRoomCode(): string {
  return randomBytes(3).toString("hex").toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

async function generateUniqueRoomCode(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRoomCode();
    if (!ROOM_CODE_REGEX.test(code)) continue;
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique room code");
}

export const roomService = {
  async createRoom(_data: CreateRoomInput): Promise<Room> {
    const code = await generateUniqueRoomCode();
    return prisma.room.create({ data: { code } });
  },

  async getRoomByCode(code: string): Promise<(Room & { members: (RoomMember & { guest: { id: string; name: string; avatar: string } })[] }) | null> {
    return prisma.room.findUnique({
      where: { code },
      include: {
        members: {
          where: { leftAt: null },
          include: { guest: { select: { id: true, name: true, avatar: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
  },

  async joinRoom(guestId: string, code: string): Promise<{ room: Room; members: (RoomMember & { guest: { id: string; name: string; avatar: string } })[] }> {
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      throw new Error("Room not found");
    }

    const existingMember = await prisma.roomMember.findUnique({
      where: { guestId_roomId: { guestId, roomId: room.id } },
    });

    // If already an active member, just return the room
    if (existingMember && !existingMember.leftAt) {
      const updatedRoom = await this.getRoomByCode(code);
      if (!updatedRoom) throw new Error("Room not found after join");
      return { room: updatedRoom, members: updatedRoom.members };
    }

    const activeMembersCount = await prisma.roomMember.count({
      where: { roomId: room.id, leftAt: null },
    });

    // Hard 5-member limit. Even returning (previously-left) members are
    // rejected when the room is full — otherwise a rejoin could push an
    // active room to 6 members.
    if (activeMembersCount >= ROOM_MAX_MEMBERS) {
      throw new Error("Room is full");
    }

    await prisma.roomMember.upsert({
      where: { guestId_roomId: { guestId, roomId: room.id } },
      update: { leftAt: null },
      create: { guestId, roomId: room.id },
    });

    const updatedRoom = await this.getRoomByCode(code);
    if (!updatedRoom) throw new Error("Room not found after join");
    return { room: updatedRoom, members: updatedRoom.members };
  },

  async leaveRoom(guestId: string, code: string): Promise<void> {
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      throw new Error("Room not found");
    }

    const member = await prisma.roomMember.findUnique({
      where: { guestId_roomId: { guestId, roomId: room.id } },
    });

    if (member && !member.leftAt) {
      await prisma.roomMember.update({
        where: { id: member.id },
        data: { leftAt: new Date() },
      });
    }
  },

  async getActiveMembers(code: string): Promise<(RoomMember & { guest: { id: string; name: string; avatar: string } })[]> {
    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        members: {
          where: { leftAt: null },
          include: { guest: { select: { id: true, name: true, avatar: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    return room?.members ?? [];
  },

  async getMessages(roomId: string, limit = 50, cursor?: string): Promise<{ messages: (Message & { guest: { id: string; name: string; avatar: string } })[]; hasMore: boolean }> {
    const messages = await prisma.message.findMany({
      where: { roomId },
      include: { guest: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, limit) : messages;
    results.reverse();

    return { messages: results, hasMore };
  },

  async createMessage(roomId: string, guestId: string, content: string): Promise<Message & { guest: { id: string; name: string; avatar: string } }> {
    return prisma.message.create({
      data: { roomId, guestId, content },
      include: { guest: { select: { id: true, name: true, avatar: true } } },
    });
  },

  async verifyActiveMember(roomId: string, guestId: string): Promise<boolean> {
    const member = await prisma.roomMember.findUnique({
      where: { guestId_roomId: { guestId, roomId } },
    });
    return member !== null && member.leftAt === null;
  },
};