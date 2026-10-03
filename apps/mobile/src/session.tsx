import { CreateGuestSchema } from "@room5/shared";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, restoreCookie } from "./api";
import type { GuestProfile } from "./types";

const PROFILE_KEY = "room5.profile";

interface SessionValue {
  guest: GuestProfile | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  restore: () => Promise<void>;
  createGuest: (name: string, avatar: string) => Promise<void>;
  updateGuest: (name: string, avatar: string) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoring = useRef<Promise<void> | null>(null);

  const restore = useCallback(async () => {
    if (restoring.current) return restoring.current;
    const work = (async () => {
      setError(null);
      try {
        const raw = await SecureStore.getItemAsync(PROFILE_KEY);
        let stored: ReturnType<typeof CreateGuestSchema.safeParse> | null = null;
        try { stored = raw ? CreateGuestSchema.safeParse(JSON.parse(raw)) : null; }
        catch { stored = null; }
        if (!stored?.success) {
          setGuest(null);
          return;
        }
        await restoreCookie();
        try {
          setGuest(await api.guest.get());
        } catch (cause) {
          if (cause instanceof ApiError && (cause.status === 401 || cause.status === 404)) {
            setGuest(await api.guest.create(stored.data.name, stored.data.avatar));
          } else {
            throw cause;
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not restore your session");
      } finally {
        setReady(true);
      }
    })();
    restoring.current = work;
    try { await work; } finally { restoring.current = null; }
  }, []);

  useEffect(() => { void restore(); }, [restore]);

  const createGuest = useCallback(async (name: string, avatar: string) => {
    const data = CreateGuestSchema.parse({ name, avatar });
    setBusy(true);
    setError(null);
    try {
      const created = await api.guest.create(data.name, data.avatar);
      await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(data));
      setGuest(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your profile");
      throw cause;
    } finally { setBusy(false); }
  }, []);

  const updateGuest = useCallback(async (name: string, avatar: string) => {
    const data = CreateGuestSchema.parse({ name, avatar });
    setBusy(true);
    setError(null);
    try {
      const updated = await api.guest.update(data);
      await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(data));
      setGuest(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your profile");
      throw cause;
    } finally { setBusy(false); }
  }, []);

  return <SessionContext.Provider value={{ guest, ready, busy, error, restore, createGuest, updateGuest }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
