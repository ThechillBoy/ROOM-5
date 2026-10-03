import { create } from "zustand";
import { api } from "../services";
import { Room, Message } from "@room5/shared";

interface RoomMember {
  id: string;
  guestId: string;
  roomId: string;
  joinedAt: string;
  leftAt: string | null;
  guest: {
    id: string;
    name: string;
    avatar: string;
  };
}

interface MessageWithGuest extends Message {
  guest: {
    id: string;
    name: string;
    avatar: string;
  };
  tempId?: string;
}

interface RoomState {
  room: (Room & { members: RoomMember[] }) | null;
  messages: MessageWithGuest[];
  loading: boolean;
  error: string | null;
  pendingMessages: Map<string, MessageWithGuest>;
  setRoom: (room: RoomState["room"]) => void;
  clearRoom: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: (messages: RoomState["messages"]) => void;
  addMessage: (message: MessageWithGuest) => void;
  addMember: (member: RoomMember) => void;
  removeMember: (guestId: string) => void;
  replacePendingMessage: (tempId: string, realMessage: MessageWithGuest) => void;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: (code: string) => Promise<void>;
  fetchRoom: (code: string) => Promise<void>;
  fetchMessages: (code: string) => Promise<void>;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  messages: [],
  loading: false,
  error: null,
  pendingMessages: new Map(),

  setRoom: (room) => set({ room, error: null }),
  clearRoom: () => set({ room: null, messages: [], error: null, pendingMessages: new Map() }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  // Live presence: keep the member sidebar/capacity indicator current without
  // waiting for a re-join. Idempotent — a returning guest just moves to the end.
  addMember: (member) =>
    set((state) => {
      if (!state.room) return state;
      if (state.room.members.some((m) => m.guestId === member.guestId)) return state;
      return {
        room: { ...state.room, members: [...state.room.members, member] },
      };
    }),
  removeMember: (guestId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          members: state.room.members.filter((m) => m.guestId !== guestId),
        },
      };
    }),
  replacePendingMessage: (tempId, realMessage) =>
    set((state) => {
      const newPending = new Map(state.pendingMessages);
      newPending.delete(tempId);
      const hasMatch = state.messages.some((m) => m.tempId === tempId);
      return {
        messages: hasMatch
          ? state.messages.map((m) => (m.tempId === tempId ? realMessage : m))
          : [...state.messages, realMessage],
        pendingMessages: newPending,
      };
    }),

  createRoom: async () => {
    set({ loading: true, error: null });
    try {
      const { code } = await api.room.create();
      set({ loading: false });
      return code;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create room";
      set({ error: message, loading: false });
      throw error;
    }
  },

  joinRoom: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const result = await api.room.join(code);
      const roomWithMembers = { ...result.room, members: result.members };
      set({ room: roomWithMembers, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join room";
      set({ error: message, loading: false });
      throw error;
    }
  },

  leaveRoom: async (code: string) => {
    set({ loading: true, error: null });
    try {
      await api.room.leave(code);
      set({ room: null, messages: [], loading: false, pendingMessages: new Map() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to leave room";
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchRoom: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const room = await api.room.get(code);
      set({ room, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch room";
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchMessages: async (code: string) => {
    try {
      const result = await api.room.getMessages(code);
      set({ messages: result.messages });
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  },
}));