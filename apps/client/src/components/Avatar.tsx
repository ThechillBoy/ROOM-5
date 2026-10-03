import { motion } from "framer-motion";

interface AvatarProps {
  avatar: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  status?: "online" | "idle" | "offline";
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
  "2xl": "w-24 h-24 text-2xl",
};

const statusSizeClasses = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-4 h-4",
  "2xl": "w-5 h-5",
};

const statusColors = {
  online: "bg-success border-dark-bg",
  idle: "bg-warning border-dark-bg",
  offline: "bg-dark-textMuted border-dark-bg",
};

export function Avatar({
  avatar,
  name,
  size = "md",
  status = "online",
  showStatus = false,
  className = "",
  onClick,
}: AvatarProps) {
  const isEmoji = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u.test(avatar);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const display = isEmoji ? avatar : initials || "?";

  const bgColors = [
    "bg-red-500/20 text-red-400",
    "bg-orange-500/20 text-orange-400",
    "bg-amber-500/20 text-amber-400",
    "bg-green-500/20 text-green-400",
    "bg-teal-500/20 text-teal-400",
    "bg-blue-500/20 text-blue-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-violet-500/20 text-violet-400",
    "bg-purple-500/20 text-purple-400",
    "bg-pink-500/20 text-pink-400",
  ];

  const colorIndex = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % bgColors.length;
  const bgClass = isEmoji ? "bg-dark-bgElevated" : bgColors[colorIndex];

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center rounded-full font-medium
        ${sizeClasses[size]} ${bgClass} ${className}
        ${onClick ? "cursor-pointer active:scale-[0.95] transition-transform duration-75" : ""}
      `}
      aria-label={name}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="relative z-10 select-none">{display}</span>

      {/* Subtle glow ring for emoji avatars */}
      {isEmoji && (
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-accent/30 to-purple-500/30 blur-xl -inset-1"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Status indicator */}
      {showStatus && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`
            absolute bottom-0 right-0 rounded-full border-2
            ${statusSizeClasses[size]} ${statusColors[status]}
          `}
          aria-label={`Status: ${status}`}
        />
      )}

      {/* Click ripple effect */}
      {onClick && (
        <motion.div
          className="absolute inset-0 rounded-full bg-white/10"
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}
    </Component>
  );
}