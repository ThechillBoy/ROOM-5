import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const positionStyles = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles = {
  top: "top-full left-1/2 -translate-x-1/2 border-t",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b",
  left: "left-full top-1/2 -translate-y-1/2 border-l",
  right: "right-full top-1/2 -translate-y-1/2 border-r",
};

export function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
      setIsVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setTimeout(() => setShowTooltip(false), 150);
  };

  return (
    <>
      {React.cloneElement(children as React.ReactElement, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      <AnimatePresence>
        {showTooltip && createPortal(
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 8 : position === "bottom" ? -8 : 0, x: position === "left" ? 8 : position === "right" ? -8 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`
              fixed z-50 px-3 py-2 text-xs font-medium text-dark-text
              bg-dark-bgCard/95 backdrop-blur-xl border border-dark-borderBright
              rounded-lg shadow-glow whitespace-nowrap pointer-events-none
              ${positionStyles[position]}
            `}
            style={{ transformOrigin: position === "top" ? "bottom center" : position === "bottom" ? "top center" : "center" }}
          >
            {content}
            <motion.div
              className={`
                absolute w-0 h-0 border-4 border-transparent
                ${arrowStyles[position]}
              `}
              style={{
                borderColor: position === "top" ? "transparent transparent var(--color-bg-card) transparent" :
                  position === "bottom" ? "var(--color-bg-card) transparent transparent transparent" :
                    position === "left" ? "transparent transparent transparent var(--color-bg-card)" :
                      "transparent var(--color-bg-card) transparent transparent"
              }}
            />
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </>
  );
}