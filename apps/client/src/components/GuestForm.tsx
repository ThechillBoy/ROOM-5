import { useState, FormEvent, ChangeEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGuest } from "../hooks";
import { Button, Avatar, Input, EmojiPicker } from ".";
import { GUEST_NAME_MAX, GUEST_AVATAR_MAX } from "@room5/shared";
import { ArrowRight } from "lucide-react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function GuestForm() {
  const { createGuest, loading, error } = useGuest();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; avatar?: string }>({});
  const [creating, setCreating] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const validate = () => {
    const newErrors: { name?: string; avatar?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    else if (name.length > GUEST_NAME_MAX) newErrors.name = `Name must be ${GUEST_NAME_MAX} characters or less`;
    if (!avatar.trim()) newErrors.avatar = "Avatar is required";
    else if (avatar.length > GUEST_AVATAR_MAX) newErrors.avatar = `Avatar must be ${GUEST_AVATAR_MAX} characters or less`;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setCreating(true);
    try {
      await createGuest({ name: name.trim(), avatar: avatar.trim() });
      navigate("/lobby");
    } catch {
      // Error handled by store
    } finally {
      setCreating(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setAvatar(emoji);
    setShowEmojiPicker(false);
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (!avatar || avatar.length === 1) {
      setAvatar(getInitials(value));
    }
  };

  return (
    <div className="min-h-screen flex flex-col page-shell">
      <div className="animated-bg" />
      <div className="noise-overlay" />
      <div className="grid-pattern" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 glass-medium border-b border-dark-borderBright px-4 py-4"
      >
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold text-center gradient-text"
        >
          Room5
        </motion.h1>
      </motion.header>

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-1 flex items-center justify-center p-4 relative z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-md"
        >
          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="glass-card p-8 relative overflow-hidden"
          >
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
                Welcome to Room5
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-dark-textSecondary mb-8 max-w-sm mx-auto"
              >
                Create your profile to start chatting in private rooms with up to 5 people.
              </motion.p>

              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* Avatar Selector */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-4"
                >
                  <Avatar avatar={avatar || "?"} name={name || "Guest"} size="2xl" status="online" showStatus />
<AnimatePresence>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji: string) => {
                        setAvatar(emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                      triggerRef={emojiButtonRef}
                      placement="bottom"
                    />
                  )}
                </AnimatePresence>
                  <motion.button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-20 h-20 rounded-2xl bg-dark-bgElevated/50 border border-dark-border hover:border-accent/30 hover:bg-dark-bgCard/50 flex items-center justify-center text-4xl transition-all duration-125"
                    aria-label="Choose emoji avatar"
                    aria-expanded={showEmojiPicker}
                  >
                    {avatar || "?"}
                  </motion.button>
                </motion.div>

                {/* Name Input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Input
                    label="Display Name"
                    value={name}
                    onChange={handleNameChange}
                    error={errors.name}
                    maxLength={GUEST_NAME_MAX}
                    placeholder="Enter your name"
                    autoFocus
                    leftIcon={<span className="text-dark-textMuted">👤</span>}
                  />
                </motion.div>

                {/* Avatar Input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Input
                    label="Avatar (emoji or initials)"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    error={errors.avatar}
                    maxLength={GUEST_AVATAR_MAX}
                    placeholder="Or emoji"
                    helperText="Leave empty to use initials from name"
                    leftIcon={<span className="text-dark-textMuted">✨</span>}
                  />
                </motion.div>

                {/* Server error — surfaced, never hidden */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-danger text-center"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Submit Button */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  type="submit"
                  disabled={creating || loading}
                  className="w-full btn-primary btn-lg group"
                >
                  <span className="flex items-center justify-center gap-2">
{creating || loading ? (
                      <span>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center justify-center"
                        >
                          <motion.div className="h-4 w-4 animate-spin">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </motion.div>
                        </motion.div>
                      </span>
                    ) : (
                      <span>
                        Continue
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </motion.div>
                      </span>
                    )}
                  </span>
                </motion.button>
              </motion.form>
            </div>
          </motion.div>
        </motion.div>
      </motion.main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="relative z-10 glass-subtle border-t border-dark-border/50 px-4 py-4"
      >
        <p className="text-center text-sm text-dark-textMuted max-w-4xl mx-auto">
          Room5 v1 — Private realtime chat for small groups. Maximum 5 users per room.
        </p>
      </motion.footer>

      {/* Emoji Picker Portal */}
      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => {
              setAvatar(emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
            triggerRef={emojiButtonRef}
            placement="bottom"
          />
        )}
      </AnimatePresence>
    </div>
  );
}