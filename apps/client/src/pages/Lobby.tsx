import { useGuest } from "../hooks";
import { Button, Avatar, ProfileModal, GuestForm, Tooltip } from "../components";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";

const spinAnimation = {
  rotate: [0, 0, 360],
  transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
};

const loadingAnimation = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  className: "flex flex-col items-center gap-4",
};

const spinnerClassName = "w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow";

const progressBarClassName = "w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden";

export function Lobby() {
  const { guest, hydrated } = useGuest();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  // Only wait during hydration. If hydrated but no guest (401 / new browser),
  // fall through to the GuestForm below.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow"
            animate={{ rotate: [0, 0, 360], transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" } }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </motion.div>
          <p className="text-dark-textMuted">Loading your space...</p>
          <div className="w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full"
              animate={{ x: [-100, 100] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!guest) {
    return <GuestForm />;
  }

  return (
    <div className="min-h-screen flex flex-col page-shell">
      {/* Animated background */}
      <div className="animated-bg" />
      <div className="noise-overlay" />
      <div className="grid-pattern" />

      {/* Header */}
      <header className="relative z-10 glass-medium border-b border-dark-borderBright px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-dark-text gradient-text"
          >
            Room5
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3"
          >
            <Avatar avatar={guest.avatar} name={guest.name} size="md" status="online" showStatus />
            <span className="text-sm font-medium text-dark-text hidden sm:block">{guest.name}</span>
            <Tooltip content="Edit Profile" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfile(true)}
                leftIcon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              >
                Profile
              </Button>
            </Tooltip>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="glass-card p-8 relative overflow-hidden"
          >
            {/* Subtle glow accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl -translate-x-1/2 translate-y-1/2" />

            <div className="relative z-10 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow"
              >
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-dark-text mb-2"
              >
                Welcome back, {guest.name}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-dark-textSecondary mb-8 max-w-sm mx-auto"
              >
                Create a private chat room for up to 5 people. Share the link and start chatting instantly.
              </motion.p>

<motion.button
                onClick={() => navigate("/room/new")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary btn-lg group"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Room
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                    className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.div>
                </span>
              </motion.button>
            </div>
          </motion.div>

          {/* Recent Rooms (placeholder for future) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-8"
          >
            <h3 className="text-sm font-medium text-dark-textMuted mb-4 text-center">Recent rooms will appear here</h3>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 glass-subtle border-t border-dark-border/50 px-4 py-4">
        <p className="text-center text-sm text-dark-textMuted max-w-4xl mx-auto">
          Room5 v1 — Private realtime chat for small groups. Maximum 5 users per room.
        </p>
      </footer>

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}