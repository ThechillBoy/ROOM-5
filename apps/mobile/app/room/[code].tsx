import { Ionicons } from "@expo/vector-icons";
import { MESSAGE_MAX_LENGTH, ROOM_CODE_REGEX, ROOM_MAX_MEMBERS } from "@room5/shared";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { roomLink, webRoomLink } from "../../src/config";
import { useRoomChannel } from "../../src/room-channel";
import { useSession } from "../../src/session";
import type { ChatMessage, RoomMember } from "../../src/types";
import { ActionButton, Avatar, Brand, color, EmojiPicker, ErrorBanner, Panel, Screen } from "../../src/ui";

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessageBubble({ message, mine, onRetry }: { message: ChatMessage; mine: boolean; onRetry: () => void }) {
  return <View style={[styles.messageRow, mine && styles.mineRow]}>
    {!mine ? <Avatar avatar={message.guest.avatar} name={message.guest.name} size={33}/> : null}
    <View style={[styles.messageWrap, mine && styles.mineWrap]}>
      {!mine ? <Text style={styles.sender}>{message.guest.name}</Text> : null}
      <View style={[styles.bubble, mine && styles.mineBubble, message.status === "failed" && styles.failedBubble]}>
        <Text style={styles.messageText}>{message.content}</Text>
      </View>
      <View style={[styles.messageMeta, mine && styles.mineMeta]}>
        <Text style={styles.time}>{timeLabel(message.createdAt)}{message.status === "sending" ? " · Sending…" : ""}</Text>
        {message.status === "failed" ? <Pressable onPress={onRetry} accessibilityLabel="Retry message"><Text style={styles.retryText}>Tap to retry</Text></Pressable> : null}
      </View>
    </View>
  </View>;
}

function MemberSheet({ visible, members, onClose, myId }: { visible: boolean; members: RoomMember[]; onClose: () => void; myId: string }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.scrim} onPress={onClose}/>
    <View style={styles.memberSheet}>
      <View style={styles.sheetHead}>
        <View><Text style={styles.sheetTitle}>People in this room</Text><Text style={styles.sheetSub}>{members.length}/{ROOM_MAX_MEMBERS} seats filled</Text></View>
        <Pressable onPress={onClose} accessibilityLabel="Close member list"><Ionicons name="close" size={24} color={color.secondary}/></Pressable>
      </View>
      {members.map((member) => <View key={member.id} style={styles.memberItem}>
        <Avatar avatar={member.guest.avatar} name={member.guest.name} size={44}/>
        <View style={styles.memberText}><Text style={styles.memberName}>{member.guest.name}{member.guestId === myId ? "  (you)" : ""}</Text><Text style={styles.memberStatus}>In the room</Text></View>
        <View style={styles.onlineDot}/>
      </View>)}
      {Array.from({ length: Math.max(0, ROOM_MAX_MEMBERS - members.length) }, (_, i) =>
        <View key={"empty-" + i} style={styles.emptySeat}><Ionicons name="person-add-outline" size={19} color={color.muted}/><Text style={styles.emptyText}>Open seat</Text></View>)}
    </View>
  </Modal>;
}

export default function RoomScreen() {
  const router = useRouter();
  const { code: rawCode } = useLocalSearchParams<{ code?: string }>();
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode || "").toUpperCase();
  const validCode = ROOM_CODE_REGEX.test(code);
  const { guest, ready } = useSession();
  const channel = useRoomChannel(code, ready ? guest : null);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const reversed = useMemo(() => [...channel.messages].reverse(), [channel.messages]);

  useEffect(() => {
    if (ready && !guest) router.replace({ pathname: "/onboarding", params: { room: code } });
  }, [ready, guest, code, router]);

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setNotice("Room code copied");
    setTimeout(() => setNotice(null), 2500);
  }

  async function shareRoom() {
    try { await Share.share({ message: "Join my Room5 space: " + code + "\n" + roomLink(code) + (webRoomLink(code) ? "\n" + webRoomLink(code) : ""), title: "Join Room5" }); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Could not share invite"); }
  }

  function confirmLeave() {
    Alert.alert("Leave this room?", "You can return later if there is an open seat.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave room", style: "destructive", onPress: () => {
        setLeaving(true);
        void channel.leave().then(() => router.replace("/lobby")).catch((cause) => {
          setLeaving(false);
          setNotice(cause instanceof Error ? cause.message : "Could not leave the room");
        });
      } },
    ]);
  }

  function sendMessage() {
    if (channel.send(draft)) { setDraft(""); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }
  }

  if (!ready || !guest) return <Screen><ActivityIndicator color={color.blue} style={styles.loading}/></Screen>;
  if (!validCode) return <Screen><View style={styles.problem}><Brand/><ErrorBanner message="This invite link has an invalid room code."/><ActionButton title="Back to lobby" onPress={() => router.replace("/lobby")}/></View></Screen>;
  if (channel.full) return <Screen><View style={styles.problem}><Brand/><View style={styles.problemIcon}><Ionicons name="people" size={36} color={color.warning}/></View><Text style={styles.problemTitle}>This room is full.</Text><Text style={styles.problemText}>Five people are already here. Ask for another invite or try this room again later.</Text><ActionButton title="Try again" icon="refresh" onPress={channel.retry}/><ActionButton title="Back to lobby" secondary onPress={() => router.replace("/lobby")}/></View></Screen>;
  if (channel.loading && !channel.room) return <Screen><View style={styles.problem}><Brand/><ActivityIndicator color={color.blue} size="large" style={{ marginTop: 40 }}/><Text style={styles.problemText}>Opening room {code}…</Text></View></Screen>;
  if (!channel.room) return <Screen><View style={styles.problem}><Brand/><ErrorBanner message={channel.error || "Could not open this room."}/><ActionButton title="Try again" icon="refresh" onPress={channel.retry}/><ActionButton title="Back to lobby" secondary onPress={() => router.replace("/lobby")}/></View></Screen>;

  return <Screen>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Brand caption="THE ROOM IS LIVE" />
          <Pressable onPress={confirmLeave} disabled={leaving} style={styles.iconButton} accessibilityLabel="Leave room"><Ionicons name="exit-outline" size={22} color={color.secondary}/></Pressable>
        </View>
        <View style={styles.roomLine}>
          <View><Text style={styles.roomLabel}>PRIVATE ROOM</Text><Text style={styles.roomCode}>{code}</Text></View>
          <Pressable onPress={() => setMembersOpen(true)} style={styles.memberBadge} accessibilityLabel={"View " + channel.members.length + " members"}>
            <Ionicons name="people-outline" size={18} color={color.success}/><Text style={styles.count}>{channel.members.length}/{ROOM_MAX_MEMBERS}</Text>
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => void copyCode()} style={styles.smallAction}><Ionicons name="copy-outline" size={17} color={color.blue}/><Text style={styles.smallActionText}>Copy code</Text></Pressable>
          <Pressable onPress={() => void shareRoom()} style={styles.smallAction}><Ionicons name="share-social-outline" size={17} color={color.blue}/><Text style={styles.smallActionText}>Invite</Text></Pressable>
        </View>
      </View>

      <View style={styles.connectionBar}>
        <View style={[styles.connectionDot, { backgroundColor: channel.connected ? color.success : color.warning }]}/>
        <Text style={styles.connectionText}>{channel.connected ? "Connected · Only your circle can see this" : "Reconnecting to your room…"}</Text>
      </View>
      {channel.error ? <View style={styles.inlineError}><ErrorBanner message={channel.error}/><ActionButton title="Retry connection" icon="refresh" secondary compact onPress={channel.retry}/></View> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <FlatList ref={listRef} style={styles.list} contentContainerStyle={styles.listContent}
        data={reversed} inverted keyboardShouldPersistTaps="handled" keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} mine={item.guestId === guest.id} onRetry={() => channel.retryMessage(item)}/>}
        ListHeaderComponent={channel.messages.length === 0 ? <View style={styles.emptyChat}><Ionicons name="chatbubble-ellipses-outline" size={38} color={color.blue}/><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptySubtitle}>Say hello to your circle.</Text></View> : null}
        ListFooterComponent={channel.hasMore ? <Pressable onPress={() => void channel.loadOlder()} disabled={channel.loadingOlder} style={styles.olderButton}><Text style={styles.olderText}>{channel.loadingOlder ? "Loading…" : "Load older messages"}</Text></Pressable> : null}
      />
      <View style={styles.composer}>
        <Pressable onPress={() => setEmojiOpen(true)} accessibilityLabel="Open emoji picker" style={styles.emojiButton}><Ionicons name="happy-outline" size={26} color={color.secondary}/></Pressable>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Message your circle…" placeholderTextColor={color.muted}
          multiline maxLength={MESSAGE_MAX_LENGTH} style={styles.input} selectionColor={color.blue}/>
        <Pressable onPress={sendMessage} disabled={!draft.trim() || !channel.connected} accessibilityLabel="Send message"
          style={[styles.sendButton, (!draft.trim() || !channel.connected) && { opacity: 0.42 }]}>
          <Ionicons name="arrow-up" size={22} color="#fff"/>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    <EmojiPicker visible={emojiOpen} onClose={() => setEmojiOpen(false)} onSelect={(emoji) => setDraft((current) => current + emoji)} title="Add an emoji"/>
    <MemberSheet visible={membersOpen} onClose={() => setMembersOpen(false)} members={channel.members} myId={guest.id}/>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center" },
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 17, borderBottomWidth: 1, borderColor: color.line, backgroundColor: "#101A2B" },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: color.raised, alignItems: "center", justifyContent: "center" },
  roomLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24 },
  roomLabel: { color: color.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  roomCode: { color: color.text, fontSize: 29, fontWeight: "900", letterSpacing: 5, marginTop: 4 },
  memberBadge: { flexDirection: "row", gap: 7, alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#255B54", backgroundColor: "#102D2F" },
  count: { color: color.success, fontWeight: "800", fontSize: 15 },
  headerActions: { flexDirection: "row", gap: 13, marginTop: 17 },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  smallActionText: { color: color.blue, fontSize: 13, fontWeight: "700" },
  connectionBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 21, paddingVertical: 9, backgroundColor: "#0B1525" },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: color.secondary, fontSize: 11 },
  inlineError: { margin: 12, gap: 8 },
  notice: { color: color.success, textAlign: "center", paddingVertical: 6, fontSize: 12 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 20, flexGrow: 1 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginVertical: 7, maxWidth: "86%" },
  mineRow: { alignSelf: "flex-end", justifyContent: "flex-end" },
  messageWrap: { flexShrink: 1, gap: 4 },
  mineWrap: { alignItems: "flex-end" },
  sender: { color: color.secondary, fontSize: 11, fontWeight: "700", marginLeft: 7 },
  bubble: { backgroundColor: "#1A2A43", borderRadius: 17, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: color.line },
  mineBubble: { backgroundColor: "#2651A0", borderColor: "#4275D0", borderBottomLeftRadius: 17, borderBottomRightRadius: 5 },
  failedBubble: { borderColor: color.danger },
  messageText: { color: color.text, fontSize: 15, lineHeight: 21 },
  messageMeta: { flexDirection: "row", gap: 7, marginLeft: 6 },
  mineMeta: { justifyContent: "flex-end", marginRight: 6 },
  time: { color: color.muted, fontSize: 10 },
  retryText: { color: color.danger, fontSize: 10, fontWeight: "800" },
  emptyChat: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyTitle: { color: color.text, fontSize: 19, fontWeight: "800", marginTop: 16 },
  emptySubtitle: { color: color.secondary, fontSize: 13, marginTop: 6 },
  olderButton: { padding: 14, alignItems: "center" },
  olderText: { color: color.blue, fontSize: 13, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 13, borderTopWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  emojiButton: { width: 39, height: 43, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, maxHeight: 116, minHeight: 43, backgroundColor: "#0A1424", borderColor: color.line, borderWidth: 1, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 10, color: color.text, fontSize: 15 },
  sendButton: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: color.blue },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.64)" },
  memberSheet: { backgroundColor: color.surface, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: 1, borderColor: color.line, padding: 22, paddingBottom: 35 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { color: color.text, fontSize: 21, fontWeight: "800" },
  sheetSub: { color: color.secondary, fontSize: 12, marginTop: 4 },
  memberItem: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 },
  memberText: { flex: 1 },
  memberName: { color: color.text, fontWeight: "700", fontSize: 15 },
  memberStatus: { color: color.success, fontSize: 11, marginTop: 3 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success },
  emptySeat: { flexDirection: "row", gap: 16, alignItems: "center", paddingVertical: 14, paddingLeft: 12, opacity: 0.7 },
  emptyText: { color: color.muted, fontSize: 14 },
  problem: { flex: 1, padding: 25, justifyContent: "center", gap: 18 },
  problemIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#413019", marginTop: 25 },
  problemTitle: { color: color.text, fontSize: 31, fontWeight: "900" },
  problemText: { color: color.secondary, fontSize: 15, lineHeight: 22 },
});
