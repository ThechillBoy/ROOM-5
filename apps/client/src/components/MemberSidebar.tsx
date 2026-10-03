import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import { MemberChip } from "./MemberChip";
import { MemberStatusDot } from "./MemberStatusDot";

interface MemberSidebarProps {
  members: Array<{ guest: { id: string; name: string; avatar: string } }>;
  currentGuestId: string;
  maxMembers: number;
  variant: "sidebar" | "drawer" | "bottom-sheet";
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export function MemberSidebar({
  members,
  currentGuestId,
  maxMembers = 5,
  variant = "sidebar",
  isOpen = true,
  onClose,
  className = "",
}: MemberSidebarProps) {
  const [animatedMembers, setAnimatedMembers] = useState<string[]>([]);

  // Stagger animation on mount/open
  useEffect(() => {
    if (isOpen) {
      const timeouts = members.map((member, i) => {
        return setTimeout(() => {
          setAnimatedMembers((prev) => [...prev, member.guest.id]);
        }, i * 60);
      });
      return () => timeouts.forEach(clearTimeout);
    } else {
      setAnimatedMembers([]);
    }
  }, [isOpen, members]);

  const sortedMembers = [...members].sort((a, b) => {
    if (a.guest.id === currentGuestId) return -1;
    if (b.guest.id === currentGuestId) return 1;
    return 0;
  });

  const emptySlots = maxMembers - members.length;

  // For sidebar variant, render inline
  if (variant === "sidebar") {
    const sidebarClassName = "w-72 bg-dark-bgCard/60 backdrop-blur-2xl border-l border-dark-borderBright flex flex-col h-full " + className;
    return (
      <motion.aside
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
        className={sidebarClassName}
      >
        <div className="p-4 border-b border-dark-borderBright flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-dark-text">Members</h3>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-0.5 text-xs font-medium text-accent bg-accent/15 rounded-full"
            >
              {members.length}/{maxMembers}
            </motion.span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedMembers.map((member, i) => {
            const isCurrent = member.guest.id === currentGuestId;
            const isAnimated = animatedMembers.includes(member.guest.id);
            return (
              <AnimatePresence key={member.guest.id}>
                {isAnimated && (
                  <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                  >
                    <MemberChip
                      name={member.guest.name}
                      avatar={member.guest.avatar}
                      isCurrentUser={isCurrent}
                      status="online"
                      size="md"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}

          {/* Empty slots */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <motion.div
              key={`empty-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.4, scale: 1 }}
              transition={{ delay: sortedMembers.length * 0.06 + i * 0.06 }}
              className="flex items-center gap-2 px-3 py-2 bg-dark-bgElevated/30 border border-dark-border/50 rounded-xl"
            >
              <motion.div
                className="w-10 h-10 rounded-full bg-dark-border/30 flex items-center justify-center"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-dark-textMuted/50 text-lg">+</span>
              </motion.div>
              <span className="text-sm text-dark-textMuted">Empty slot</span>
            </motion.div>
          ))}
        </div>
      </motion.aside>
    );
  }

  // For drawer and bottom-sheet, render as portal
  if (!isOpen) return null;

  const isDrawer = variant === "drawer";

  const overlayClassName = "fixed inset-0 z-50";
  const panelClassName = "fixed " + (isDrawer ? "inset-y-0 right-0 w-80" : "bottom-0 left-0 right-0 max-h-[70vh]") + " z-50";
  const contentClassName = "bg-dark-bgCard/95 backdrop-blur-2xl border-l border-dark-borderBright flex flex-col " + (isDrawer ? "h-full" : "max-h-[70vh] rounded-t-2xl") + " shadow-glow-lg";

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={overlayClassName}
        onClick={onClose}
        aria-hidden="true"
      >
        <motion.div
          initial={{
            x: isDrawer ? "100%" : "0",
            y: isDrawer ? 0 : "100%",
            opacity: 0,
          }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ x: isDrawer ? "100%" : 0, y: isDrawer ? 0 : "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={panelClassName + " " + contentClassName}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Room members"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark-borderBright">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              <h3 className="font-semibold text-dark-text">Members</h3>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2 py-0.5 text-xs font-medium text-accent bg-accent/15 rounded-full"
              >
                {members.length}/{maxMembers}
              </motion.span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-dark-textMuted"
              aria-label="Close member panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sortedMembers.map((member, i) => {
              const isCurrent = member.guest.id === currentGuestId;
              const isAnimated = animatedMembers.includes(member.guest.id);
              return (
                <AnimatePresence key={member.guest.id}>
                  {isAnimated && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                    >
                      <MemberChip
                        name={member.guest.name}
                        avatar={member.guest.avatar}
                        isCurrentUser={isCurrent}
                        status="online"
                        size="md"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <motion.div
                key={`empty-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.4, scale: 1 }}
                transition={{ delay: sortedMembers.length * 0.06 + i * 0.06 }}
                className="flex items-center gap-2 px-3 py-2 bg-dark-bgElevated/30 border border-dark-border/50 rounded-xl"
              >
                <motion.div
                  className="w-10 h-10 rounded-full bg-dark-border/30 flex items-center justify-center"
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-dark-textMuted/50 text-lg">+</span>
                </motion.div>
                <span className="text-sm text-dark-textMuted">Empty slot</span>
              </motion.div>
            ))}
          </div>

          {/* Close handle for bottom sheet */}
          {!isDrawer && (
            <div className="flex justify-center p-2">
              <div className="w-10 h-1 bg-dark-border/50 rounded-full" />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}