import { motion } from "framer-motion";
import { Avatar } from "./Avatar";
import { MemberStatusDot } from "./MemberStatusDot";

interface MemberChipProps {
  name: string;
  avatar: string;
  isCurrentUser?: boolean;
  status?: "online" | "idle" | "offline";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const sizeClasses = {
  sm: "px-2 py-1 gap-1.5 text-xs",
  md: "px-3 py-1.5 gap-2 text-sm",
  lg: "px-4 py-2 gap-2 text-base",
};

const avatarSizeMap = {
  sm: "xs" as const,
  md: "sm" as const,
  lg: "md" as const,
};

const statusSizeMap = {
  sm: "xs" as const,
  md: "sm" as const,
  lg: "md" as const,
};

export function MemberChip({
  name,
  avatar,
  isCurrentUser = false,
  status = "online",
  size = "md",
  onClick,
}: MemberChipProps) {
  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        inline-flex items-center gap-2 rounded-xl bg-dark-bgElevated/50
        border border-dark-border hover:border-accent/30 hover:bg-dark-bgCard/50
        transition-all duration-125 ease-expo-out
        ${onClick ? "cursor-pointer active:scale-[0.98]" : ""}
      `}
    >
      <div className="relative">
        <Avatar
          avatar={avatar}
          name={name}
          size={avatarSizeMap[size]}
          status={status}
          showStatus
        />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="font-medium text-dark-text truncate">
          {name}
          {isCurrentUser && (
            <span className="ml-1.5 text-[10px] font-semibold text-accent bg-accent/15 px-1.5 py-0.5 rounded-full">
              You
            </span>
          )}
        </span>
        <span className="text-[10px] text-dark-textMuted capitalize">
          {status}
        </span>
      </div>
    </Component>
  );
}