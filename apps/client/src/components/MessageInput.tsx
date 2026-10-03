import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";
import { EmojiPicker } from "./EmojiPicker";
import { Smile, Send, X } from "lucide-react";

interface MessageInputProps {
  onSend: (content: string, tempId: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [content]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    onSend(trimmed, tempId);
    setContent("");
    setShowEmojiPicker(false);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const charCount = content.length;
  const isNearLimit = charCount > 3500;
  const isAtLimit = charCount >= 4000;

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="relative p-4 bg-dark-bgCard/60 backdrop-blur-xl border-t border-dark-borderBright"
    >
      {/* Emoji Picker Portal */}
      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => {
              setContent((prev) => prev + emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
            triggerRef={emojiButtonRef}
            placement="top"
          />
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        {/* Emoji Button */}
        <motion.button
          ref={emojiButtonRef}
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 p-2 rounded-xl bg-dark-bgElevated/50 border border-dark-border hover:border-accent/30 hover:bg-dark-bgCard/50 text-dark-textMuted hover:text-accent transition-all duration-125 disabled:opacity-40"
          aria-label="Emoji picker"
          aria-expanded={showEmojiPicker}
        >
          <Smile className="h-5 w-5" />
        </motion.button>

        {/* Textarea */}
        <div className="relative flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={`
              w-full min-h-[48px] max-h-[160px] px-4 py-3 pr-12
              bg-dark-bgElevated/50 border border-dark-border
              text-dark-text placeholder-dark-textMuted
              rounded-xl outline-none resize-none
              transition-all duration-125 ease-expo-out
              focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-dark-bgCard
              disabled:opacity-40 disabled:cursor-not-allowed
              ${isAtLimit ? "border-danger" : isNearLimit ? "border-warning" : ""}
            `}
            disabled={disabled}
            rows={1}
            aria-label="Message input"
          />
          {/* Character count */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: isNearLimit ? 1 : 0, x: 0 }}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-mono"
          >
            <span className={`
              ${isAtLimit ? "text-danger" : isNearLimit ? "text-warning" : "text-dark-textMuted/50"}
            `}>
              {charCount}
            </span>
            <span className="text-dark-textMuted/30">/4000</span>
          </motion.div>
        </div>

        {/* Send Button */}
        <motion.button
          ref={pickerTriggerRef}
          type="submit"
          disabled={disabled || !content.trim() || isAtLimit}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-accent to-blue-500 text-white
            hover:from-blue-500 hover:to-blue-600 hover:shadow-glow
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:from-accent disabled:hover:to-blue-500
            transition-all duration-125
          `}
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Error hint */}
      {isAtLimit && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-danger flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Maximum message length reached (4000 characters)
        </motion.p>
      )}
    </motion.form>
  );
}