import { ROOM_CODE_REGEX, SendMessageSchema } from "@room5/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";
import { api, ApiError, mergeMessages, socketCookieHeader } from "./api";
import { API_ORIGIN } from "./config";
import type { ChatMessage, GuestProfile, RoomInfo, RoomMember, RoomSnapshot } from "./types";

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not connect to the room";
}

export function useRoomChannel(code: string, guest: GuestProfile | null) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [generation, setGeneration] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const leavingRef = useRef(false);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const next = mergeMessages(current, incoming);
      messagesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!guest || !ROOM_CODE_REGEX.test(code)) {
      if (guest) { setError("Invalid room code"); setLoading(false); }
      return;
    }
    let active = true;
    leavingRef.current = false;
    setLoading(true);
    setConnected(false);
    setError(null);
    setFull(false);
    setRoom(null);
    setMembers([]);
    setMessages([]);
    messagesRef.current = [];

    async function fetchLatest() {
      const page = await api.room.messages(code);
      if (!active) return;
      merge(page.messages);
      setHasMore(page.hasMore);
    }

    async function enter() {
      try {
        const joined = await api.room.join(code);
        if (!active) return;
        setRoom(joined.room);
        setMembers(joined.members);
        await fetchLatest();
        if (!active) return;

        const cookie = await socketCookieHeader();
        if (!active) return;
        const socket = io(API_ORIGIN, {
          autoConnect: false,
          withCredentials: true,
          extraHeaders: cookie ? { Cookie: cookie } : undefined,
          reconnection: true,
        });
        socketRef.current = socket;
        socket.on("connect", () => {
          if (!active || leavingRef.current) return;
          setError(null);
          socket.emit("room:join", { code });
          void fetchLatest().catch((cause) => { if (active) setError(errorText(cause)); });
        });
        socket.on("disconnect", () => { if (active) setConnected(false); });
        socket.on("connect_error", (cause: Error) => {
          if (active) { setConnected(false); setError(errorText(cause)); }
        });
        socket.on("room:state", (state: RoomSnapshot) => {
          if (!active || state.room.code !== code) return;
          setRoom(state.room);
          setMembers(state.members);
          setConnected(true);
          setError(null);
          setFull(false);
        });
        socket.on("room:error", (payload: { message: string }) => {
          if (!active) return;
          setConnected(false);
          setFull(payload.message === "Room is full");
          setError(payload.message);
        });
        socket.on("message:new", (message: ChatMessage) => {
          if (active && message.roomId === joined.room.id) merge([{ ...message, status: undefined }]);
        });
        socket.on("message:error", (payload: { tempId: string; message: string }) => {
          if (!active) return;
          setMessages((current) => {
            const next = current.map((message) => message.tempId === payload.tempId ? { ...message, status: "failed" as const } : message);
            messagesRef.current = next;
            return next;
          });
          setError(payload.message);
        });
        socket.on("presence:join", (payload: { guestId: string }) => {
          if (active && payload.guestId !== guest!.id) {
            void api.room.members(code).then((list) => { if (active) setMembers(list); }).catch(() => {});
          }
        });
        socket.on("presence:leave", (payload: { guestId: string }) => {
          if (active) setMembers((current) => current.filter((member) => member.guestId !== payload.guestId));
        });
        socket.connect();
      } catch (cause) {
        if (!active) return;
        setFull(cause instanceof ApiError && cause.status === 409);
        setError(errorText(cause));
      } finally {
        if (active) setLoading(false);
      }
    }

    void enter();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !active || leavingRef.current) return;
      void api.room.join(code).then((joined) => {
        if (!active) return;
        setRoom(joined.room);
        setMembers(joined.members);
        void fetchLatest().catch((cause) => { if (active) setError(errorText(cause)); });
        const socket = socketRef.current;
        if (socket?.connected) socket.emit("room:join", { code });
        else socket?.connect();
      }).catch((cause) => {
        if (!active) return;
        setConnected(false);
        setFull(cause instanceof ApiError && cause.status === 409);
        setError(errorText(cause));
      });
    });
    return () => {
      active = false;
      subscription.remove();
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [code, guest?.id, generation, merge]);

  const send = useCallback((content: string): boolean => {
    const parsed = SendMessageSchema.safeParse({ content });
    const socket = socketRef.current;
    if (!parsed.success) { setError("Write a message before sending."); return false; }
    if (!guest || !room || !socket?.connected || !connected) {
      setError("Connecting to the room. Try again in a moment.");
      return false;
    }
    const tempId = "mobile-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    merge([{
      id: tempId, roomId: room.id, guestId: guest.id, content: parsed.data.content,
      createdAt: new Date().toISOString(), guest, tempId, status: "sending",
    }]);
    socket.emit("message:send", { code, content: parsed.data.content, tempId });
    setError(null);
    return true;
  }, [code, connected, guest, room, merge]);

  const retryMessage = useCallback((message: ChatMessage) => {
    if (message.status !== "failed") return;
    if (send(message.content)) {
      setMessages((current) => {
        const next = current.filter((item) => item.id !== message.id);
        messagesRef.current = next;
        return next;
      });
    }
  }, [send]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current.find((message) => !message.id.startsWith("mobile-"));
    if (!oldest || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await api.room.messages(code, oldest.id);
      merge(page.messages);
      setHasMore(page.hasMore);
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoadingOlder(false); }
  }, [code, hasMore, loadingOlder, merge]);

  const leave = useCallback(async () => {
    leavingRef.current = true;
    socketRef.current?.emit("room:leave", { code });
    socketRef.current?.disconnect();
    await api.room.leave(code);
  }, [code]);

  return {
    room, members, messages, loading, connected, error, full, hasMore, loadingOlder,
    send, retryMessage, loadOlder, leave,
    retry: () => setGeneration((value) => value + 1),
    dismissError: () => setError(null),
  };
}
