import { motion } from "framer-motion";

interface MemberStatusDotProps {
  status: "online" | "idle" | "offline";
  size?: "xs" | "sm" | "md" | "lg";
  showPulse?: boolean;
}

const sizeClasses = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

const statusColors = {
  online: "bg-success",
  idle: "bg-warning",
  offline: "bg-dark-textMuted/50",
};

export function MemberStatusDot({
  status,
  size = "sm",
  showPulse = true,
}: MemberStatusDotProps) {
  return (
    <motion.span
      className={`
        relative inline-block rounded-full border-2 border-dark-bg
        ${sizeClasses[size]} ${statusColors[status]}
      `}
      aria-label={`Status: ${status}`}
    >
      {showPulse && status === "online" && (
        <motion.span
          className="absolute inset-0 rounded-full bg-success opacity-60"
          animate={{ scale: [1, 2], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </motion.span>
  );
}