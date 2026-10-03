import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGuest } from "../hooks";
import { useRoom } from "../hooks";
import { 
  Avatar, 
  Button, 
  ProfileModal, 
  LeaveButton, 
  MessageList, 
  MessageInput,
  MemberSidebar,
  Tooltip,
} from "../components";
import { JoinRoom } from "./JoinRoom";
import { connectSocket, onRoomState, onMessageNew, onRoomError, onMessageError, onPresenceJoin, onPresenceLeave, onSocketConnect, emitRoomJoin, emitMessageSend, emitRoomLeave } from "../services/socket";
import { useRoomStore } from "../stores/roomStore";
import { Users, Copy, X } from "lucide-react";

const spinAnimation = {
  rotate: [0, 0, 360],
  transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
};

const loadingAnimation = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  className: "flex flex-col items-center gap-4",
};

const spinnerClassName = "w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow";

const progressBarClassName = "w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden";

const progressFillAnimation = {
  animate: { x: [-100, 100] },
  transition: { duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
  style: { transformOrigin: "left" },
};

export function Room() {
  const { code } = useParams<{ code: string }>();
  const { guest, hydrated } = useGuest();
  const { room, messages, loading, error, joinRoom, leaveRoom, clearRoom, addMessage, addMember, removeMember, replacePendingMessage, fetchMessages, setMessages } = useRoom();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" }>>([]);
  const socketInitialized = useRef(false);
  const roomJoinedRef = useRef<string | null>(null);
  // Depend on the room *id* (stable string), never on the `room` object:
  // the store replaces that object on every presence/message update, which
  // would tear this socket effect down and re-run it on each update.
  const roomId = room?.id;

  const handleJoinRoom = useCallback(async () => {
    if (hydrated && guest && code) {
      try {
        await joinRoom(code.toUpperCase());
      } catch {
        // Error is surfaced via the store's error state (full-room / not-found UI)
      }
    }
  }, [hydrated, guest?.id, code, joinRoom]);

  useEffect(() => {
    handleJoinRoom();
  }, [handleJoinRoom]);

  useEffect(() => {
    if (!hydrated || !guest || !code || !roomId) return;

    const roomCode = code.toUpperCase();
    if (roomJoinedRef.current === roomCode) return;

    const joinCurrentRoom = () => emitRoomJoin({ code: roomCode });

    const offRoomState = onRoomState((state) => {
      if (state.messages.length > 0) {
        setMessages(state.messages);
      }
    });

    const offMessageNew = onMessageNew((message) => {
      if (message.tempId) {
        replacePendingMessage(message.tempId, message);
      } else {
        addMessage(message);
      }
    });

    const offRoomError = onRoomError((err) => {
      console.error("Room error:", err.message);
      addToast("error", err.message);
    });

    // A rejected send (e.g. not a member / room gone) must be visible and must
    // not leave the optimistic bubble behind as if it had been delivered.
    const offMessageError = onMessageError((err) => {
      console.error("Message error:", err.message);
      addToast("error", err.message);
      const current = useRoomStore.getState();
      current.setMessages(current.messages.filter((m) => m.tempId !== err.tempId));
    });

    // Live presence: keep the member list / capacity indicator current
    const offPresenceJoin = onPresenceJoin((p) => {
      addMember({
        id: `presence-${p.guestId}`,
        guestId: p.guestId,
        roomId,
        joinedAt: new Date().toISOString(),
        leftAt: null,
        guest: { id: p.guestId, name: p.name, avatar: p.avatar },
      });
    });
    const offPresenceLeave = onPresenceLeave((p) => {
      removeMember(p.guestId);
    });

    // Connect and join only after every listener is registered, so the room's
    // initial `room:state` can never be delivered before we are listening.
    // Re-assert membership on every (re)connection: a dropped/restarted socket
    // must not leave the guest outside the room's socket channel, which would
    // make sends fail ("Not a member") and hide incoming messages.
    connectSocket();
    const offSocketConnect = onSocketConnect(joinCurrentRoom);
    joinCurrentRoom();
    roomJoinedRef.current = roomCode;

    socketInitialized.current = true;

    return () => {
      offRoomState();
      offMessageNew();
      offRoomError();
      offMessageError();
      offSocketConnect();
      offPresenceJoin();
      offPresenceLeave();
      emitRoomLeave({ code: roomCode });
      roomJoinedRef.current = null;
      socketInitialized.current = false;
    };
  }, [hydrated, guest?.id, code, roomId, addMessage, addMember, removeMember, replacePendingMessage, setMessages]);

  const addToast = (type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleLeave = async () => {
    if (code) {
      await leaveRoom(code.toUpperCase());
    }
    clearRoom();
    roomJoinedRef.current = null;
    navigate("/lobby");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast("success", "Room link copied!");
    } catch {
      addToast("error", "Failed to copy link");
    }
  };

  const handleSendMessage = (content: string, tempId: string) => {
    if (!code || !guest) return;
    const optimisticMessage = {
      id: tempId,
      roomId: "",
      guestId: guest.id,
      content,
      createdAt: new Date(),
      guest: { id: guest.id, name: guest.name, avatar: guest.avatar },
      tempId,
    };
    addMessage(optimisticMessage);
    emitMessageSend({ code: code.toUpperCase(), content, tempId });
  };

  const members = room?.members ?? [];

  // Only wait during hydration. If hydrated but no guest (401 / new browser),
  // fall through: isMember check below routes to the JoinRoom guest form.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow"
            animate={{ rotate: [0, 0, 360], transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" } }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </motion.div>
          <p className="text-dark-textMuted">Loading your space...</p>
          <div className="w-32 h-1.5 bg-dark-bgElevated rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full"
              animate={{ x: [-100, 100] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ transformOrigin: "left" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // Check if guest is a member of this room. !guest also falls through to JoinRoom.
  const isMember = guest && room?.members?.some((m) => m.guestId === guest.id);

  // If not a member (or no guest yet), show the JoinRoom form
  if (!guest || !isMember) {
    return <JoinRoom />;
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 page-shell">
        <div className="animated-bg" />
        <div className="noise-overlay" />
        <div className="grid-pattern" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-dark-bgCard/90 backdrop-blur-xl border border-danger/30 p-8 max-w-md text-center rounded-2xl shadow-glow"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger/15 flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </motion.div>
          <h2 className="text-xl font-bold text-dark-text mb-2">Cannot Join Room</h2>
          <p className="text-dark-textSecondary mb-6">{error}</p>
          <Button onClick={() => navigate("/lobby")} variant="secondary">
            Back to Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col page-shell">
      {/* Background layers */}
      <div className="animated-bg" />
      <div className="noise-overlay" />
      <div className="grid-pattern" />

      {/* Toasts */}
      <AnimatePresence>
        {toasts.map((toast) => {
          const toastClassName = "fixed bottom-6 right-6 z-50 glass-strong px-4 py-3 rounded-xl shadow-glow animate-slide-up flex items-center gap-3 min-w-[280px] max-w-md " +
            (toast.type === "success" ? "bg-success/15 border-success/30 text-success" : "bg-danger/15 border-danger/30 text-danger");
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={toastClassName}
            >
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                className="flex-shrink-0 mt-0.5"
              >
                {toast.type === "success" ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
              </motion.div>
              <span className="text-sm font-medium text-dark-text">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 glass-medium border-b border-dark-borderBright px-4 py-3"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <LeaveButton onLeave={handleLeave} loading={loading} />
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-semibold text-dark-text"
              >
                Room {code?.toUpperCase()}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-xs text-dark-textMuted flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" />
                Private chat — {members.length}/5 users
              </motion.p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <Tooltip content="Copy room link" position="bottom">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                leftIcon={<Copy className="h-4 w-4" />}
              >
                Copy Link
              </Button>
            </Tooltip>
            <Avatar avatar={guest.avatar} name={guest.name} size="sm" status="online" showStatus />
            <motion.span
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-sm font-medium text-dark-text hidden sm:block"
            >
              {guest.name}
            </motion.span>
            <Tooltip content="Edit Profile" position="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfile(true)}
                leftIcon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              >
                Profile
              </Button>
            </Tooltip>
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => setShowMemberPanel(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-colors text-dark-textMuted"
              aria-label="Show members"
            >
              <Users className="h-5 w-5" />
            </motion.button>
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-1 flex flex-col max-w-6xl mx-auto w-full relative z-10"
      >
        {room && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex-1 flex flex-col glass-card rounded-2xl border border-dark-borderBright overflow-hidden"
          >
            <MessageList messages={messages} currentGuestId={guest.id} />
            <MessageInput onSend={handleSendMessage} disabled={loading} />
          </motion.div>
        )}

        {loading && !room && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <motion.div className="flex flex-col items-center gap-4">
              <motion.div
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow"
                animate={{ rotate: [0, 0, 360], transition: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" } }}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </motion.div>
              <p className="text-dark-textMuted">Loading room...</p>
            </motion.div>
          </motion.div>
        )}

        {!loading && !room && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center text-dark-textMuted">Loading room...</div>
          </motion.div>
        )}
      </motion.main>

      {/* Member Panel (Mobile/Tablet) */}
      <AnimatePresence>
        {showMemberPanel && (
          <MemberSidebar
            members={members.map(m => ({ guest: m.guest }))}
            currentGuestId={guest.id}
            maxMembers={5}
            variant="bottom-sheet"
            isOpen={showMemberPanel}
            onClose={() => setShowMemberPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop Member Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-40 lg:w-72">
        <MemberSidebar
          members={members.map(m => ({ guest: m.guest }))}
          currentGuestId={guest.id}
          maxMembers={5}
          variant="sidebar"
          isOpen={true}
        />
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}