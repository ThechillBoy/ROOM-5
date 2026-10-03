import { io, Socket } from "socket.io-client";
import { MessageWithGuest } from "@room5/shared";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

export type Message = MessageWithGuest & { tempId?: string };

export interface RoomState {
  room: { id: string; code: string };
  messages: Message[];
  members: Array<{
    id: string;
    guestId: string;
    roomId: string;
    joinedAt: string;
    leftAt: string | null;
    guest: { id: string; name: string; avatar: string };
  }>;
  me: { id: string; name: string; avatar: string };
}

export interface RoomJoinPayload {
  code: string;
}

export interface MessageSendPayload {
  code: string;
  content: string;
  tempId: string;
}

type EventCallback<T> = (data: T) => void;

let socket: Socket | null = null;
// Room the client currently wants to be in. Tracked here so a dropped or
// server-closed connection can transparently re-enter the room.
let joinedRoomCode: string | null = null;

function parseMessageDates(message: Message): Message {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
  };
}

function parseRoomStateDates(state: RoomState): RoomState {
  return {
    ...state,
    messages: state.messages.map(parseMessageDates),
  };
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
    });
    // Re-enter the room after any (re)connection: a server-side close, a
    // transport drop or a dev-server restart must not silently leave the
    // client out of the room.
    socket.on("connect", () => {
      if (joinedRoomCode) {
        socket?.emit("room:join", { code: joinedRoomCode });
      }
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function onRoomState(callback: EventCallback<RoomState>): () => void {
  const s = getSocket();
  const wrappedCallback = (state: RoomState) => callback(parseRoomStateDates(state));
  s.on("room:state", wrappedCallback);
  return () => s.off("room:state", wrappedCallback);
}

export function onRoomError(callback: EventCallback<{ message: string }>): () => void {
  const s = getSocket();
  s.on("room:error", callback);
  return () => s.off("room:error", callback);
}

export function onMessageNew(callback: EventCallback<Message>): () => void {
  const s = getSocket();
  const wrappedCallback = (message: Message) => callback(parseMessageDates(message));
  s.on("message:new", wrappedCallback);
  return () => s.off("message:new", wrappedCallback);
}

export function onMessageError(callback: EventCallback<{ tempId: string; message: string }>): () => void {
  const s = getSocket();
  s.on("message:error", callback);
  return () => s.off("message:error", callback);
}

export function onPresenceJoin(callback: EventCallback<{ guestId: string; name: string; avatar: string }>): () => void {
  const s = getSocket();
  s.on("presence:join", callback);
  return () => s.off("presence:join", callback);
}

export function onPresenceLeave(callback: EventCallback<{ guestId: string }>): () => void {
  const s = getSocket();
  s.on("presence:leave", callback);
  return () => s.off("presence:leave", callback);
}

export function onSocketConnect(callback: () => void): () => void {
  const s = getSocket();
  s.on("connect", callback);
  return () => s.off("connect", callback);
}

export function emitRoomJoin(payload: RoomJoinPayload): void {
  joinedRoomCode = payload.code;
  const s = getSocket();
  // Connect first: socket.io buffers the emit until the connection is open, so
  // room:join can never be silently dropped when the socket is still idle.
  if (!s.connected) s.connect();
  s.emit("room:join", payload);
}

export function emitRoomLeave(payload: RoomJoinPayload): void {
  if (joinedRoomCode === payload.code) joinedRoomCode = null;
  const s = getSocket();
  if (!s.connected) return; // no open transport: the seat frees on disconnect
  s.emit("room:leave", payload);
}

export function emitMessageSend(payload: MessageSendPayload): void {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("message:send", payload);
}