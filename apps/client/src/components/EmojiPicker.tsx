import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { FloatingFocusManager } from "@floating-ui/react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  placement?: "bottom" | "top" | "left" | "right";
}

const EMOJI_CATEGORIES = [
  { id: "recent", name: "Recent", icon: "🕐" },
  { id: "smileys", name: "Smileys", icon: "😀" },
  { id: "people", name: "People", icon: "👋" },
  { id: "animals", name: "Animals", icon: "🐶" },
  { id: "food", name: "Food", icon: "🍕" },
  { id: "activities", name: "Activities", icon: "⚽" },
  { id: "travel", name: "Travel", icon: "🌍" },
  { id: "objects", name: "Objects", icon: "💡" },
  { id: "symbols", name: "Symbols", icon: "❤️" },
  { id: "flags", name: "Flags", icon: "🏁" },
];

const EMOJI_DATA: Record<string, string[]> = {
  recent: [],
  smileys: [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😎","🤓",
    "😋","😛","😜","🤪","😝","🤗","🤭","🤫","🤔","🤨","😐","😑","😶","😏","😒","🙄",
    "😤","😠","😡","🤬","😱","😨","😰","😥","😭","😓","🤐","😷","🤒","🤕","🤢","🤮",
    "🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😴","😪","😵‍💫","🤤","😲","😳","😷","🤩",
  ],
  people: [
    "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆",
    "🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️",
    "💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁️","👅",
    "👶","🧒","👦","👧","🧑","👱","👨","🧔","👨‍🦰","👨‍🦱","👨‍🦳","👨‍🦲","👩","👩‍🦰","👩‍🦱","👩‍🦳",
    "👩‍🦲","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","🧑‍🦽","🧑‍🦼",
  ],
  animals: [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸",
    "🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺",
    "🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂",
  ],
  food: [
    "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥝",
    "🍅","🥑","🥥","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥜",
    "🍞","🥐","🥖","🫓","🥨","🥯","🥞","🧇","🧈","🥩","🍗","🍖","🦴","🌭","🍔","🍟",
    "🍕","🥪","🥙","🧆","🌮","🌯","🥟","🥠","🥡","🍜","🍲","🥣","🥘","🍝","🍜","🍲",
  ],
  activities: [
    "⚽","🏀","🏈","⚾","🥎","🏐","🏉","🥏","🎾","🏓","🏸","🏒","🏑","🥍","🏏","🪃",
    "🥅","⛳","🪁","🏹","🎣","🤿","🥽","🎽","🎿","🛷","🛹","🛼","🛸","🎯","🪀","🪁",
    "🎮","🕹️","🎰","🎲","🧩","🧸","🪅","🪆","♠️","♥️","♦️","♣️","🃏","🀄","🎴","🎭",
  ],
  travel: [
    "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️",
    "🛴","🚲","🛵","🛞","🛟","✈️","🛫","🛬","🛩️","🪂","💺","🛰️","🚀","🛸","🛎️","🧳",
    "🌍","🌎","🌏","🌐","🗺️","🗾","🏔️","⛰️","🌋","🗻","🏕️","⛺","🏖️","🏝️","🏜️","🏞️",
  ],
  objects: [
    "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","💽","💾","💿","📀","🧮","🎮","🕹️",
    "📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭",
    "⏱️","⏲️","⏰","🕰️","⌛","⏳","🧭","🔍","🔎","🔦","🕯️","🪔","🧯","🛢️","💸","💵",
  ],
  symbols: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
    "💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈",
    "♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛎","🔀","🔁","🔂","▶️",
  ],
  flags: [
    "🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇦🇨","🇦🇩","🇦🇪","🇦🇫","🇦🇬","🇦🇮","🇦🇱","🇦🇲",
    "🇦🇴","🇦🇶","🇦🇷","🇦🇸","🇦🇹","🇦🇺","🇦🇼","🇦🇽","🇦🇿","🇧🇦","🇧🇧","🇧🇩","🇧🇪","🇧🇫","🇧🇬","🇧🇭",
    "🇧🇮","🇧🇯","🇧🇱","🇧🇲","🇧🇳","🇧🇴","🇧🇶","🇧🇷","🇧🇸","🇧🇹","🇧🇻","🇧🇼","🇧🇾","🇧🇿","🇨🇦","🇨🇨",
  ],
};

const STORAGE_KEY = "room5-recent-emojis";
const MAX_RECENT = 28;

export function EmojiPicker({
  onSelect,
  onClose,
  triggerRef,
  placement = "bottom",
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Anchor the fixed-position picker to the trigger button, viewport-clamped.
  // Without coordinates a `fixed` portal renders at the body's static position
  // (below the fold), which made the avatar selector appear dead.
  const PICKER_WIDTH = 384; // w-96
  const PICKER_HEIGHT = 460; // approx: header + tabs + grid + footer
  const [position] = useState(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = triggerRef.current;
    if (!el) {
      return {
        top: Math.max(8, (vh - PICKER_HEIGHT) / 2),
        left: Math.max(8, (vw - PICKER_WIDTH) / 2),
      };
    }
    const rect = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - PICKER_WIDTH / 2;
    left = Math.max(8, Math.min(left, vw - PICKER_WIDTH - 8));
    let top = placement === "top" ? rect.top - PICKER_HEIGHT - 8 : rect.bottom + 8;
    if (top + PICKER_HEIGHT > vh - 8) {
      top = rect.top - PICKER_HEIGHT - 8; // flip above when it would overflow below
    }
    top = Math.max(8, top);
    return { top, left };
  });

  // Update recent category when recentEmojis changes
  useEffect(() => {
    EMOJI_DATA.recent = recentEmojis;
  }, [recentEmojis]);

  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return EMOJI_DATA[activeCategory] || [];
    const query = searchQuery.toLowerCase();
    return (EMOJI_DATA[activeCategory] || []).filter(emoji => {
      // Simple search - could be enhanced with emoji names/keywords
      return emoji.includes(query);
    });
  }, [activeCategory, searchQuery]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    // Add to recent
    setRecentEmojis((prev) => {
      const filtered = prev.filter(e => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          onClose();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, triggerRef]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const categoryIcons = {
    recent: "🕐",
    smileys: "😀",
    people: "👋",
    animals: "🐶",
    food: "🍕",
    activities: "⚽",
    travel: "🌍",
    objects: "💡",
    symbols: "❤️",
    flags: "🏁",
  };

  return createPortal(
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95, y: placement === "top" ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: placement === "top" ? -8 : 8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`
        fixed z-50 w-96 bg-dark-bgCard/95 backdrop-blur-2xl border border-dark-borderBright
        rounded-2xl shadow-glow overflow-hidden animate-scale-in
      `}
      style={{
        top: position.top,
        left: position.left,
        transformOrigin: placement === "top" ? "bottom center" : "top center",
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Emoji picker"
    >
      {/* Header */}
      <div className="p-3 border-b border-dark-borderBright flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="relative flex-1"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-textMuted" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full pl-10 pr-8 py-2 bg-dark-bgElevated/50 border border-dark-border rounded-xl text-dark-text placeholder-dark-textMuted text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all duration-125"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 transition-colors text-dark-textMuted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-dark-textMuted"
          aria-label="Close emoji picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Categories */}
      <div className="border-b border-dark-borderBright overflow-x-auto pb-2 px-2" role="tablist">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 + i * 0.02 }}
            onClick={() => {
              setActiveCategory(cat.id);
              setSearchQuery("");
            }}
            role="tab"
            aria-selected={activeCategory === cat.id}
            className={`
              flex-shrink-0 px-3 py-2 rounded-xl text-lg transition-all duration-125
              ${activeCategory === cat.id
                ? "bg-accent/20 text-accent"
                : "text-dark-textMuted hover:bg-white/5 hover:text-dark-text"}
            `}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const next = EMOJI_CATEGORIES[(i + 1) % EMOJI_CATEGORIES.length];
                setActiveCategory(next.id);
              } else if (e.key === "ArrowLeft") {
                const prev = EMOJI_CATEGORIES[(i - 1 + EMOJI_CATEGORIES.length) % EMOJI_CATEGORIES.length];
                setActiveCategory(prev.id);
              }
            }}
          >
            {cat.icon}
          </motion.button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-2 max-h-[320px] overflow-y-auto" role="tabpanel">
        {filteredEmojis.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-dark-textMuted">
            <p className="text-sm">No emojis found</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="grid grid-cols-8 gap-1"
            role="listbox"
            aria-label={`${EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.name} emojis`}
          >
            {filteredEmojis.map((emoji, i) => (
              <motion.button
                key={emoji}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 5, type: "spring", stiffness: 400, damping: 25 }}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleEmojiClick(emoji)}
                className="w-10 h-10 rounded-lg text-xl flex items-center justify-center
                           bg-transparent hover:bg-white/5 transition-all duration-100
                           active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                role="option"
                aria-label={emoji}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 text-center">
        <kbd className="px-2 py-1 bg-dark-bgElevated/50 border border-dark-border rounded text-xs text-dark-textMuted">
          Esc to close
        </kbd>
      </div>
    </motion.div>,
    document.body
  );
}