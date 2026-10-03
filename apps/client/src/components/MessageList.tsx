import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import { Message } from "../services/socket";

interface MessageListProps {
  messages: Message[];
  currentGuestId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MessageList({ messages, currentGuestId }: MessageListProps) {
  // Auto-scroll to the newest message
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (!messages.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex items-center justify-center"
      >
        <div className="text-center px-6">
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg className="w-8 h-8 text-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </motion.div>
          <h3 className="text-lg font-medium text-dark-text mb-1">No messages yet</h3>
          <p className="text-dark-textMuted text-sm">Send the first message to start the conversation</p>
        </div>
      </motion.div>
    );
  }

  // Group messages by sender for consecutive messages within 5 minutes
  const groupedMessages = messages.reduce((groups, message) => {
    const lastGroup = groups[groups.length - 1];
    const isSameSender = lastGroup && lastGroup.senderId === message.guest.id;
    const timeDiff = lastGroup 
      ? new Date(message.createdAt).getTime() - new Date(lastGroup.lastMessage.createdAt).getTime()
      : Infinity;
    const isConsecutive = isSameSender && timeDiff < 5 * 60 * 1000; // 5 minutes

    if (isConsecutive) {
      lastGroup.messages.push(message);
      lastGroup.lastMessage = message;
    } else {
      groups.push({
        senderId: message.guest.id,
        senderName: message.guest.name,
        senderAvatar: message.guest.avatar,
        isCurrentUser: message.guest.id === currentGuestId,
        messages: [message],
        lastMessage: message,
      });
    }
    return groups;
  }, [] as Array<{
    senderId: string;
    senderName: string;
    senderAvatar: string;
    isCurrentUser: boolean;
    messages: Message[];
    lastMessage: Message;
  }>);

  return (
    <AnimatePresence>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedMessages.map((group, groupIndex) => (
          <motion.div
            key={group.senderId + groupIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, delay: groupIndex * 0.03 }}
            className={`flex ${group.isCurrentUser ? "justify-end" : "justify-start"}`}
          >
            <div className="w-full">
              {!group.isCurrentUser && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-shrink-0 mr-3 mt-0.5"
                >
                  <Avatar
                    avatar={group.senderAvatar}
                    name={group.senderName}
                    size="xs"
                  />
                </motion.div>
              )}
              <div className={`flex flex-col ${group.isCurrentUser ? "items-end" : "items-start"}`}>
                {!group.isCurrentUser && group.messages.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-medium text-dark-textSecondary mb-1 px-1"
                  >
                    {group.senderName}
                  </motion.span>
                )}
                <AnimatePresence mode="popLayout">
                  {group.messages.map((message, msgIndex) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      transition={{
                        duration: 0.15,
                        delay: groupIndex * 0.03 + msgIndex * 0.02,
                        type: "spring",
                        stiffness: 300,
                        damping: 25
                      }}
                      className={`
                        w-fit max-w-[75%] min-w-0 px-4 py-2.5 rounded-2xl
                        ${group.isCurrentUser
                          ? "bg-gradient-to-br from-accent to-blue-500 text-white rounded-tr-sm shadow-[0_4px_16px_rgba(59,130,246,0.3)]"
                          : "bg-dark-bgCard/80 text-dark-text rounded-tl-sm border border-dark-border/50"
                        }
                        ${msgIndex === group.messages.length - 1 ? "" : "mb-1"}
                      `}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.content}</p>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`
                          block mt-1.5 text-[10px] text-right
                          ${group.isCurrentUser ? "text-blue-100/70" : "text-dark-textMuted/60"}
                        `}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </motion.span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}