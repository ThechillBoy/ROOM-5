import { useEffect } from "react";
import { useRoomStore } from "../stores/roomStore";

export function useRoom() {
  const { room, messages, loading, error, createRoom, joinRoom, leaveRoom, fetchRoom, fetchMessages, clearRoom, setRoom, addMessage, addMember, removeMember, replacePendingMessage, setMessages } = useRoomStore();

  return {
    room,
    messages,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    fetchRoom,
    fetchMessages,
    clearRoom,
    setRoom,
    addMessage,
    addMember,
    removeMember,
    replacePendingMessage,
    setMessages,
  };
}