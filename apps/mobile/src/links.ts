import { ROOM_CODE_REGEX } from "@room5/shared";

export function parseRoomCode(input: string): string | null {
  const value = input.trim();
  const code = value.toUpperCase();
  if (ROOM_CODE_REGEX.test(code)) return code;
  try {
    const url = new URL(value);
    const path = url.protocol === "room5:" && url.hostname === "room" ? "/room" + url.pathname : url.pathname;
    const match = path.match(/\/room\/([A-Za-z0-9]{6})\/?$/);
    const candidate = match?.[1]?.toUpperCase();
    return candidate && ROOM_CODE_REGEX.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
