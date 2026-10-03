import { Socket } from "socket.io";
import { prisma } from "../config/db";
import { ROOM_MAX_MEMBERS, ROOM_CODE_REGEX } from "@room5/shared";

interface RoomJoinPayload {
  code: string;
}

interface MessageSendPayload {
  code: string;
  content: string;
  tempId: string;
}

// Tracks connected socket ids per guest so disconnect can distinguish
// "guest left the app" from "guest refreshed / opened a second tab".
// A seat is only freed when the guest's LAST socket disconnects.
const guestSockets = new Map<string, Set<string>>();

export function setupRoomHandlers(io: any, socket: Socket) {
  const guest = socket.data.guest;
  if (guest) {
    const set = guestSockets.get(guest.id) ?? new Set<string>();
    set.add(socket.id);
    guestSockets.set(guest.id, set);
  }

  socket.on("room:join", async (payload: RoomJoinPayload) => {
    const { code } = payload;
    const guest = socket.data.guest;

    if (!guest) {
      socket.emit("room:error", { message: "Not authenticated" });
      return;
    }

    if (typeof code !== "string" || !ROOM_CODE_REGEX.test(code)) {
      socket.emit("room:error", { message: "Invalid room code" });
      return;
    }

    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      socket.emit("room:error", { message: "Room not found" });
      return;
    }

    const activeMembersCount = await prisma.roomMember.count({
      where: { roomId: room.id, leftAt: null },
    });

    if (activeMembersCount >= ROOM_MAX_MEMBERS) {
      const existingMember = await prisma.roomMember.findUnique({
        where: { guestId_roomId: { guestId: guest.id, roomId: room.id } },
      });
      if (!existingMember || existingMember.leftAt) {
        socket.emit("room:error", { message: "Room is full" });
        return;
      }
    }

    await prisma.roomMember.upsert({
      where: { guestId_roomId: { guestId: guest.id, roomId: room.id } },
      update: { leftAt: null },
      create: { guestId: guest.id, roomId: room.id },
    });

    socket.join(`room:${code}`);

    const messages = await prisma.message.findMany({
      where: { roomId: room.id },
      include: { guest: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const members = await prisma.roomMember.findMany({
      where: { roomId: room.id, leftAt: null },
      include: { guest: { select: { id: true, name: true, avatar: true } } },
    });

    socket.emit("room:state", {
      room: { id: room.id, code: room.code },
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        guest: m.guest,
      })),
      members: members.map((m) => ({
        id: m.id,
        guestId: m.guestId,
        roomId: m.roomId,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt?.toISOString() ?? null,
        guest: m.guest,
      })),
      me: { id: guest.id, name: guest.name, avatar: guest.avatar },
    });

    socket.to(`room:${code}`).emit("presence:join", {
      guestId: guest.id,
      name: guest.name,
      avatar: guest.avatar,
    });
  });

  socket.on("message:send", async (payload: MessageSendPayload) => {
    const { code, content, tempId } = payload;
    const guest = socket.data.guest;

    if (!guest) {
      socket.emit("message:error", { tempId, message: "Not authenticated" });
      return;
    }

    if (typeof code !== "string" || !ROOM_CODE_REGEX.test(code)) {
      socket.emit("message:error", { tempId, message: "Invalid room code" });
      return;
    }

    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      socket.emit("message:error", { tempId, message: "Room not found" });
      return;
    }

    const member = await prisma.roomMember.findUnique({
      where: { guestId_roomId: { guestId: guest.id, roomId: room.id } },
    });

    if (!member || member.leftAt) {
      socket.emit("message:error", { tempId, message: "Not a member of this room" });
      return;
    }

    if (!content.trim() || content.length > 4000) {
      socket.emit("message:error", { tempId, message: "Invalid message content" });
      return;
    }

    const message = await prisma.message.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        content: content.trim(),
      },
      include: { guest: { select: { id: true, name: true, avatar: true } } },
    });

    const messageData = {
      id: message.id,
      roomId: message.roomId,
      guestId: message.guestId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      guest: message.guest,
      tempId,
    };

    io.to(`room:${code}`).emit("message:new", messageData);
  });

  socket.on("room:leave", async (payload: RoomJoinPayload) => {
    const { code } = payload;
    const guest = socket.data.guest;

    if (!guest) return;

    socket.leave(`room:${code}`);
    socket.to(`room:${code}`).emit("presence:leave", { guestId: guest.id });
  });

  socket.on("disconnect", async () => {
    const guest = socket.data.guest;
    if (!guest) return;

    // Only free the seat when this is the guest's LAST connected socket.
    // A refresh opens a new socket before the old one disconnects, so the
    // membership survives refresh; closing the tab frees the seat.
    const sockets = guestSockets.get(guest.id);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size > 0) return;
      guestSockets.delete(guest.id);
    }

    try {
      const memberships = await prisma.roomMember.findMany({
        where: { guestId: guest.id, leftAt: null },
        select: { roomId: true },
      });

      for (const m of memberships) {
        await prisma.roomMember.updateMany({
          where: { guestId: guest.id, roomId: m.roomId, leftAt: null },
          data: { leftAt: new Date() },
        });
        const room = await prisma.room.findUnique({ where: { id: m.roomId } });
        if (room) {
          io.to(`room:${room.code}`).emit("presence:leave", { guestId: guest.id });
        }
      }
    } catch (err) {
      console.error("disconnect cleanup failed:", err);
    }
  });
}