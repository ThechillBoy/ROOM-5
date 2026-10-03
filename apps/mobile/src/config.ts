import { Platform } from "react-native";

// Local defaults are available only in Metro development builds.
const configuredApi = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/^https:\/\//i, "https://");
const developmentApi = Platform.OS === "android"
  ? "http://10.0.2.2:3000"
  : "http://localhost:3000";

export const API_ORIGIN = (configuredApi || (__DEV__ ? developmentApi : ""))
  .replace(/\/+$/, "");

if (!__DEV__ && !API_ORIGIN.startsWith("https://")) {
  throw new Error("Room5 release requires an explicit HTTPS EXPO_PUBLIC_API_URL.");
}

// Socket.io already uses API_ORIGIN; HTTPS upgrades to WSS on the same host.

export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "");

export function roomLink(code: string): string {
  return `room5:///room/${code}`;
}

export function webRoomLink(code: string): string | null {
  return WEB_ORIGIN ? `${WEB_ORIGIN}/room/${code}` : null;
}
