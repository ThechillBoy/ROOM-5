import CookieManager from "@preeternal/react-native-cookie-manager";
import * as SecureStore from "expo-secure-store";
import { API_ORIGIN } from "./config";
import type { ChatMessage, GuestProfile, MessagePage, RoomInfo, RoomMember } from "./types";

const SESSION_KEY = "room5.session-cookie";
const COOKIE_NAME = "room5.sid";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function restoreCookie(): Promise<void> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (value) {
    await CookieManager.set(API_ORIGIN, {
      name: COOKIE_NAME,
      value,
      path: "/",
      httpOnly: true,
      secure: API_ORIGIN.startsWith("https://"),
    });
  }
}

async function persistCookie(): Promise<void> {
  const cookies = await CookieManager.get(API_ORIGIN);
  const value = cookies[COOKIE_NAME]?.value;
  if (value) await SecureStore.setItemAsync(SESSION_KEY, value);
}

export async function socketCookieHeader(): Promise<string> {
  return CookieManager.getCookieHeader(API_ORIGIN);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(`Cannot reach Room5 at ${API_ORIGIN}`, 0);
  }

  // The server rolls its session cookie on requests; retain the latest value.
  await persistCookie().catch(() => {});
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body
      ? String(body.error)
      : `Request failed (${response.status})`;
    throw new ApiError(error, response.status);
  }
  return body as T;
}

export const api = {
  guest: {
    get: () => request<GuestProfile>("/guest"),
    create: (name: string, avatar: string) => request<GuestProfile>("/guest", {
      method: "POST", body: JSON.stringify({ name, avatar }),
    }),
    update: (data: { name?: string; avatar?: string }) => request<GuestProfile>("/guest", {
      method: "PATCH", body: JSON.stringify(data),
    }),
  },
  room: {
    create: () => request<RoomInfo>("/rooms", {
      method: "POST", body: "{}",
    }),
    join: (code: string) => request<{ room: RoomInfo; members: RoomMember[] }>(
      `/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ code }) },
    ),
    get: (code: string) => request<RoomInfo & { members: RoomMember[] }>(`/rooms/${code}`),
    leave: (code: string) => request<void>(`/rooms/${code}/leave`, { method: "POST" }),
    members: (code: string) => request<RoomMember[]>(`/rooms/${code}/members`),
    messages: (code: string, cursor?: string) => request<MessagePage>(
      `/rooms/${code}/messages?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  },
};

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) {
    if (message.tempId) {
      for (const [id, pending] of byId) {
        if (pending.tempId === message.tempId && id !== message.id) byId.delete(id);
      }
    }
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
