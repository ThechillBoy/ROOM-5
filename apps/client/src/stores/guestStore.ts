import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ApiError } from "../services";
import { Guest, CreateGuestInput, GUEST_NAME_MAX, GUEST_AVATAR_MAX } from "@room5/shared";

interface GuestState {
  guest: Guest | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  _hydratePromise: Promise<void> | null;
  setGuest: (guest: Guest) => void;
  clearGuest: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hydrate: () => Promise<void>;
  createGuest: (data: CreateGuestInput) => Promise<void>;
  updateGuest: (data: Partial<CreateGuestInput>) => Promise<void>;
}

const STORAGE_KEY = "room5-guest";

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      guest: null,
      loading: false,
      error: null,
      hydrated: false,
      _hydratePromise: null as Promise<void> | null,

      setGuest: (guest) => set({ guest, error: null }),
      clearGuest: () => set({ guest: null }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

hydrate: async function() {
        const existingPromise = get()._hydratePromise;
        if (existingPromise) {
          return existingPromise;
        }

        let resolvePromise: (value: void) => void = () => {};
        const promise = new Promise<void>((resolve) => {
          resolvePromise = resolve;
        });

        const readStoredIdentity = (): { name: string; avatar: string } | null => {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (!stored) return null;
          try {
            const parsed = JSON.parse(stored);
            const rawName = parsed.state?.guest?.name ?? parsed.name;
            const rawAvatar = parsed.state?.guest?.avatar ?? parsed.avatar;
            // Sanitize strictly: a stored identity must be a sane printable
            // name. Corrupted values (e.g. "\\") are DISCARDED, never replayed
            // into a new Guest row.
            const isSane = (v: unknown) =>
              typeof v === "string" &&
              /^[\p{L}\p{N}\p{Emoji_Presentation}\p{Extended_Pictographic}][\p{L}\p{N}\p{Emoji_Presentation}\p{Extended_Pictographic} _-]*$/u.test(v.trim());
            const name = isSane(rawName) ? rawName.trim().slice(0, GUEST_NAME_MAX) : "";
            const avatar = isSane(rawAvatar) ? rawAvatar.trim().slice(0, GUEST_AVATAR_MAX) : "";
            if (!name || !avatar) {
              localStorage.removeItem(STORAGE_KEY);
              return null;
            }
            return { name, avatar };
          } catch {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
        };

        const runHydration = async () => {
          try {
            // Fast path: with no persisted identity there is nothing to restore
            // for this browser, so the server probe is meaningless. Skipping it
            // avoids a guaranteed 401 (and its console error) on every first
            // visit and lets the guest form paint immediately.
            const storedIdentity = readStoredIdentity();
            if (!storedIdentity) {
              set({ guest: null, hydrated: true, _hydratePromise: null });
              resolvePromise();
              return;
            }

            try {
              const guest = await api.guest.get();
              set({ guest, hydrated: true, _hydratePromise: null });
              resolvePromise();
            } catch (error) {
              if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
                // The session has no Guest row (e.g. dev server restart wiped
                // the session store). Clear any phantom guest first, then
                // re-create exactly ONE guest from the sane stored identity.
                set({ guest: null });
                await get().createGuest(storedIdentity);
                set({ hydrated: true, _hydratePromise: null });
                resolvePromise();
                return;
              }
              throw error;
            }
          } catch (error) {
            // Unexpected failure: surface the real error, never spin forever.
            console.error("Guest hydrate error:", error);
            set({
              hydrated: true,
              _hydratePromise: null,
              error: error instanceof Error ? error.message : "Failed to restore your session",
            });
            resolvePromise();
          } finally {
            const state = get();
            if (state._hydratePromise === promise) {
              set({ _hydratePromise: null });
            }
          }
        };

        runHydration();
        set({ _hydratePromise: promise });
        return promise;
      },

      createGuest: async (data) => {
        set({ loading: true, error: null });
        try {
          const guest = await api.guest.create(data.name, data.avatar);
          set({ guest, loading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create guest";
          set({ error: message, loading: false });
          throw error;
        }
      },

      updateGuest: async (data) => {
        const { guest } = get();
        if (!guest) return;

        set({ loading: true, error: null });
        try {
          const updated = await api.guest.update(data);
          set({ guest: updated, loading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to update guest";
          set({ error: message, loading: false });
          throw error;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        guest: state.guest ? { name: state.guest.name, avatar: state.guest.avatar } : null,
      }),
    }
  )
);
