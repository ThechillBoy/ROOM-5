import { useEffect, useRef } from "react";
import { useGuestStore } from "../stores";

export function useGuest() {
  const store = useGuestStore();
  const hydratedRef = useRef(store.hydrated);

  useEffect(() => {
    let cancelled = false;

    // Only hydrate if not already hydrated and not currently hydrating
    if (!store.hydrated && !store._hydratePromise) {
      store.hydrate().catch(() => {});
    }

    // Update ref when hydrated changes
    hydratedRef.current = store.hydrated;

    return () => { cancelled = true; };
  }, []); // Run once on mount

  // Keep ref in sync
  useEffect(() => {
    hydratedRef.current = store.hydrated;
  }, [store.hydrated]);

  return {
    guest: store.guest,
    loading: store.loading,
    error: store.error,
    hydrated: store.hydrated,
    createGuest: store.createGuest,
    updateGuest: store.updateGuest,
    setGuest: store.setGuest,
  };
}