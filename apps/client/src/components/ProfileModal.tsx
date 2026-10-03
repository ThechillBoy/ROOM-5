import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useGuestStore } from "../stores";
import { Button, Input, Avatar, EmojiPicker } from "./";
import { GUEST_NAME_MAX, GUEST_AVATAR_MAX } from "@room5/shared";
import { X, CheckCircle, Loader2 } from "lucide-react";

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { guest, updateGuest, loading } = useGuestStore();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; avatar?: string }>({});
  const [saved, setSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && guest) {
      setName(guest.name);
      setAvatar(guest.avatar);
      setErrors({});
      setSaved(false);
    }
  }, [isOpen, guest]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (!showEmojiPicker) onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !showEmojiPicker) onClose();
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, showEmojiPicker]);

  const validate = () => {
    const newErrors: { name?: string; avatar?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    else if (name.length > GUEST_NAME_MAX) newErrors.name = `Name must be ${GUEST_NAME_MAX} characters or less`;
    if (!avatar.trim()) newErrors.avatar = "Avatar is required";
    else if (avatar.length > GUEST_AVATAR_MAX) newErrors.avatar = `Avatar must be ${GUEST_AVATAR_MAX} characters or less`;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await updateGuest({ name: name.trim(), avatar: avatar.trim() });
      setSaved(true);
      setTimeout(() => onClose(), 500);
    } catch {
      // Error handled by store
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setAvatar(emoji);
    setShowEmojiPicker(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-md glass-strong rounded-2xl shadow-glow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-dark-borderBright flex items-center justify-between">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              id="profile-modal-title"
              className="text-lg font-semibold text-dark-text"
            >
              Edit Profile
            </motion.h2>
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-dark-textMuted"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </motion.button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Avatar Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-4"
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
              <div className="relative flex-1">
                <motion.button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full w-20 h-20 rounded-2xl bg-dark-bgElevated/50 border border-dark-border hover:border-accent/30 hover:bg-dark-bgCard/50 flex items-center justify-center text-4xl transition-all duration-125"
                  aria-label="Choose emoji avatar"
                  aria-expanded={showEmojiPicker}
                >
                  {avatar || "?"}
                </motion.button>
              </div>
            </motion.div>

            {/* Name Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Input
                label="Display Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              transition={{ delay: 0.2 }}
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

            {/* Emoji Picker Portal */}
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

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex gap-3 pt-2"
            >
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                className="flex-1 btn-primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    Save
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <CheckCircle className="h-4 w-4 ml-1" />
                    </motion.span>
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}