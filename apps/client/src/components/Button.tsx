import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDragStart" | "onDragEnd" | "onDrag" | "onDragEnter" | "onDragLeave" | "onDragOver" | "onDrop" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  whileHover?: { scale?: number };
  whileTap?: { scale?: number };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      leftIcon,
      rightIcon,
      fullWidth = false,
      whileHover,
      whileTap,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-medium rounded-xl
      transition-all duration-125 ease-expo-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg
      disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
      active:scale-[0.97]
      select-none
      ${fullWidth ? 'w-full' : ''}
    `;

    const variantStyles = {
      primary: "bg-gradient-to-r from-accent to-blue-500 text-white hover:from-blue-500 hover:to-blue-600 hover:shadow-glow active:from-blue-600 active:to-blue-700",
      secondary: "bg-dark-bgHover text-dark-text hover:bg-dark-borderBright hover:shadow-inner-glow border border-dark-border",
      ghost: "bg-transparent text-dark-textSecondary hover:bg-dark-bgHover hover:text-dark-text",
      danger: "bg-gradient-to-r from-danger to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:from-red-700 active:to-red-800",
      outline: "bg-transparent text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/50 hover:text-accentHover",
    };

    const sizeStyles = {
      sm: "px-3 py-1.5 text-sm gap-1.5",
      md: "px-4 py-2 text-base gap-2",
      lg: "px-6 py-3 text-lg gap-2.5",
      icon: "p-2",
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        whileHover={whileHover ?? { scale: 1.01 }}
        whileTap={whileTap ?? { scale: 0.97 }}
        {...props}
      >
        {loading ? (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </motion.div>
            <span className="sr-only">Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";