import { Guest, Room, Message } from "@room5/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function parseMessageDates(message: Message & { guest: { id: string; name: string; avatar: string } }): Message & { guest: { id: string; name: string; avatar: string } } {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
  };
}

function parseMessagesResponse(data: { messages: (Message & { guest: { id: string; name: string; avatar: string } })[]; hasMore: boolean }): { messages: (Message & { guest: { id: string; name: string; avatar: string } })[]; hasMore: boolean } {
  return {
    ...data,
    messages: data.messages.map(parseMessageDates),
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      (data as any)?.error || `HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data as T;
}

export const api = {
  guest: {
    create: (name: string, avatar: string) =>
      request<Guest>("/guest", {
        method: "POST",
        body: JSON.stringify({ name, avatar }),
      }),

    get: () => request<Guest>("/guest"),

    update: (data: { name?: string; avatar?: string }) =>
      request<Guest>("/guest", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  room: {
    create: () =>
      request<{ id: string; code: string }>("/rooms", {
        method: "POST",
        body: JSON.stringify({}),
      }),

    get: (code: string) =>
      request<Room & { members: Array<{ id: string; guestId: string; roomId: string; joinedAt: string; leftAt: string | null; guest: { id: string; name: string; avatar: string } }> }>(`/rooms/${code}`),

    join: (code: string) =>
      request<{ room: Room; members: Array<{ id: string; guestId: string; roomId: string; joinedAt: string; leftAt: string | null; guest: { id: string; name: string; avatar: string } }> }>(`/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    leave: (code: string) =>
      request<void>(`/rooms/${code}/leave`, {
        method: "POST",
      }),

    getMembers: (code: string) =>
      request<Array<{ id: string; guestId: string; roomId: string; joinedAt: string; leftAt: string | null; guest: { id: string; name: string; avatar: string } }>>(`/rooms/${code}/members`),

    getMessages: (code: string, params?: { limit?: number; cursor?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.cursor) searchParams.set("cursor", params.cursor);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return request<{ messages: (Message & { guest: { id: string; name: string; avatar: string } })[]; hasMore: boolean }>(`/rooms/${code}/messages${query}`).then(parseMessagesResponse);
    },
  },
};

export { ApiError };