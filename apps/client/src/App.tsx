import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useGuest } from "./hooks";
import { useRoom } from "./hooks";
import { Lobby, Room, JoinRoom } from "./pages";
import { Button } from "./components";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

const spinAnimation = {
  rotate: [0, 0, 360],
  transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" as const },
};

const loadingAnimation = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  className: "flex flex-col items-center gap-4",
};

const spinnerClassName = "w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow";

const progressBarClassName = "w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden";

const progressFillAnimation = {
  animate: { x: [-100, 100] },
  transition: { duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const },
  style: { transformOrigin: "left" },
};

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { guest, hydrated } = useGuest();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <motion.div {...loadingAnimation}>
          <motion.div className={spinnerClassName} animate={spinAnimation}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </motion.div>
          <p className="text-dark-textMuted">Loading your space...</p>
          <div className={progressBarClassName}>
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full"
              {...progressFillAnimation}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!guest) {
    return <Navigate to="/lobby" replace />;
  }

  return <>{children}</>;
}

function OptionalGuest({ children }: { children: React.ReactNode }) {
  const { guest, hydrated } = useGuest();

  // Only wait during hydration. If hydrated but no guest (401 / new browser),
  // render children: Room falls back to the JoinRoom guest form.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <motion.div {...loadingAnimation}>
          <motion.div className={spinnerClassName} animate={spinAnimation}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </motion.div>
          <p className="text-dark-textMuted">Loading room...</p>
          <div className={progressBarClassName}>
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full"
              animate={{ x: [-100, 100] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }}
              style={{ transformOrigin: "left" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/lobby" element={<Lobby />} />
      <Route
        path="/room/:code"
        element={
          <OptionalGuest>
            <Room />
          </OptionalGuest>
        }
      />
      <Route
        path="/room/new"
        element={
          <RequireGuest>
            <CreateRoomRedirect />
          </RequireGuest>
        }
      />
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}

function CreateRoomRedirect() {
  const { guest } = useGuest();
  const { createRoom, error, loading } = useRoom();
  const hasAttemptedRef = React.useRef(false);
  const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type: "success" | "error" }>>([]);

  React.useEffect(() => {
    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    const attemptCreate = async () => {
      try {
        const code = await createRoom();
        window.location.href = `/room/${code}`;
      } catch {
        // Error is already set in store by createRoom
      }
    };

    attemptCreate();
  }, [createRoom]);

  const addToast = React.useCallback((type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  React.useEffect(() => {
    if (error && !loading) {
      addToast("error", error);
    }
  }, [error, loading, addToast]);

  if (error && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="animated-bg" />
        <div className="noise-overlay" />
        <div className="grid-pattern" />
        <AnimatePresence>
          {toasts.map((toast) => {
            const toastClassName = "fixed top-6 right-6 z-50 glass-strong px-4 py-3 rounded-xl shadow-glow animate-slide-up flex items-center gap-3 min-w-[280px] max-w-md " +
              (toast.type === "success" ? "bg-success/15 border-success/30 text-success" : "bg-danger/15 border-danger/30 text-danger");
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={toastClassName}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                  className="flex-shrink-0 mt-0.5"
                >
                  <AlertCircle className="h-5 w-5" />
                </motion.div>
                <span className="text-sm font-medium text-dark-text">{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="glass-strong p-8 rounded-2xl shadow-glow-lg max-w-md w-full mx-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/15 flex items-center justify-center"
          >
            <AlertCircle className="w-8 h-8 text-danger" />
          </motion.div>
          <h2 className="text-xl font-bold text-dark-text mb-2 text-center">Failed to Create Room</h2>
          <p className="text-dark-textSecondary mb-6 text-center">{error}</p>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => { hasAttemptedRef.current = false; window.location.reload(); }}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Try Again
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center page-shell">
      <div className="animated-bg" />
      <div className="noise-overlay" />
      <div className="grid-pattern" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow"
          animate={spinAnimation}
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-dark-textMuted"
        >
          Creating your room...
        </motion.p>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full"
            animate={{ x: [-100, 100] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }}
            style={{ transformOrigin: "left" }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;