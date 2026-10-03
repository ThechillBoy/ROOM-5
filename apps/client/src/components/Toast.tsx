import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const typeStyles = {
  success: "bg-success/15 border-success/30 text-success",
  error: "bg-danger/15 border-danger/30 text-danger",
  warning: "bg-warning/15 border-warning/30 text-warning",
  info: "bg-accent/15 border-accent/30 text-accent",
};

const typeIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const Icon = typeIcons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-glow ${typeStyles[toast.type]} min-w-[280px] max-w-md`}
    >
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
        className="flex-shrink-0 mt-0.5"
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dark-text">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-dark-textMuted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <AnimatePresence>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </AnimatePresence>
  );
}

// Toast hook for easy usage
import { useState, useCallback } from "react";

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: Toast = { id, type, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => addToast("success", message, duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast("error", message, duration), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast("warning", message, duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast("info", message, duration), [addToast]);

  return { toasts, addToast, removeToast, success, error, warning, info };
}