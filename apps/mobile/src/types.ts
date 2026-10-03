import type { Guest, MessageWithGuest, Room } from "@room5/shared";

export type GuestProfile = Pick<Guest, "id" | "name" | "avatar">;
export type RoomInfo = Pick<Room, "id" | "code">;

export interface RoomMember {
  id: string;
  guestId: string;
  roomId: string;
  joinedAt: string;
  leftAt: string | null;
  guest: GuestProfile;
}

export type ChatMessage = Omit<MessageWithGuest, "createdAt"> & {
  createdAt: string;
  tempId?: string;
  status?: "sending" | "failed";
};

export interface RoomSnapshot {
  room: RoomInfo;
  members: RoomMember[];
  messages: ChatMessage[];
  me: GuestProfile;
}

export interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}
