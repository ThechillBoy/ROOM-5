import { InputHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, className = "", id, leftIcon, rightIcon, ...props },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const hasIcon = leftIcon || rightIcon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className={`w-full ${className}`}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-dark-textSecondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-textMuted pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-4 py-3 bg-dark-bgElevated/50 border border-dark-border
              text-dark-text placeholder-dark-textMuted
              rounded-xl outline-none
              transition-all duration-125 ease-expo-out
              focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-dark-bgCard
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:border-dark-borderBright
              ${hasIcon ? (leftIcon ? "pl-12" : "pr-12") : ""}
              ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""}
            `}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {rightIcon && !error && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-textMuted pointer-events-none">
              {rightIcon}
            </div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-danger flex items-center"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </motion.div>
          )}
        </div>
        {error && (
          <motion.p
            id={`${inputId}-error`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-sm text-danger flex items-center gap-1"
            role="alert"
          >
            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <motion.p
            id={`${inputId}-helper`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-sm text-dark-textMuted"
          >
            {helperText}
          </motion.p>
        )}
      </motion.div>
    );
  }
);

Input.displayName = "Input";