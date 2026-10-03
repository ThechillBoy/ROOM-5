import { ROOM_CODE_LENGTH, ROOM_MAX_MEMBERS, CreateGuestSchema, GUEST_NAME_MAX } from "@room5/shared";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api, ApiError } from "../src/api";
import { parseRoomCode } from "../src/links";
import { useSession } from "../src/session";
import { ActionButton, Avatar, Brand, color, EmojiPicker, ErrorBanner, Field, Panel, Screen } from "../src/ui";

export default function LobbyScreen() {
  const router = useRouter();
  const { guest, ready, busy: profileBusy, updateGuest } = useSession();
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🚀");
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    if (ready && !guest) router.replace("/onboarding");
  }, [ready, guest, router]);
  useEffect(() => {
    if (guest && !editing) { setName(guest.name); setAvatar(guest.avatar); }
  }, [guest, editing]);

  function showError(cause: unknown) {
    setFull(cause instanceof ApiError && cause.status === 409);
    setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
  }

  async function createRoom() {
    setBusy("create"); setError(null); setFull(false);
    try {
      const room = await api.room.create();
      await api.room.join(room.code);
      router.push({ pathname: "/room/[code]", params: { code: room.code } });
    } catch (cause) { showError(cause); }
    finally { setBusy(null); }
  }

  async function joinRoom() {
    const code = parseRoomCode(codeInput);
    if (!code) { setError("Enter a six-character room code or a Room5 invite link."); setFull(false); return; }
    setBusy("join"); setError(null); setFull(false);
    try {
      await api.room.join(code);
      router.push({ pathname: "/room/[code]", params: { code } });
    } catch (cause) { showError(cause); }
    finally { setBusy(null); }
  }

  async function pasteCode() {
    const text = await Clipboard.getStringAsync();
    setCodeInput(text);
    setError(null); setFull(false);
  }

  async function saveProfile() {
    const result = CreateGuestSchema.safeParse({ name: name.trim(), avatar });
    if (!result.success) { setError("Enter a name to continue (up to 32 characters)."); return; }
    setError(null);
    try { await updateGuest(result.data.name, result.data.avatar); setEditing(false); }
    catch (cause) { showError(cause); }
  }

  if (!ready || !guest) return <Screen><ActivityIndicator color={color.blue} style={styles.loading}/></Screen>;
  return <Screen scroll>
    <View style={styles.top}>
      <Brand caption="PRIVATE SPACE · FIVE SEATS" />
      <Pressable onPress={() => setEditing(!editing)} accessibilityLabel="Edit profile" style={styles.profileButton}>
        <Avatar avatar={guest.avatar} name={guest.name} size={42}/>
      </Pressable>
    </View>
    <Text style={styles.eyebrow}>WELCOME BACK, {guest.name.toUpperCase()}</Text>
    <Text style={styles.title}>Your room awaits.</Text>
    <Text style={styles.subtitle}>Create a space for your circle or enter an invite code to join one.</Text>

    {editing ? <Panel style={styles.profilePanel}>
      <Text style={styles.panelTitle}>Your profile</Text>
      <View style={styles.profilePreview}><Avatar avatar={avatar} name={name} size={58}/><Text style={styles.profileName}>{name || "Your name"}</Text></View>
      <Field label="Display name" value={name} onChangeText={setName} maxLength={GUEST_NAME_MAX}/>
      <ActionButton title={avatar + "  Change avatar"} icon="happy-outline" secondary onPress={() => setEmojiOpen(true)}/>
      <ActionButton title={profileBusy ? "Saving…" : "Save profile"} icon="checkmark" disabled={profileBusy} onPress={() => void saveProfile()}/>
    </Panel> : null}

    <Panel style={styles.createPanel}>
      <View style={styles.iconTile}><Ionicons name="add" size={29} color={color.blue}/></View>
      <Text style={styles.panelTitle}>Create a room</Text>
      <Text style={styles.panelBody}>A fresh private space for you and up to {ROOM_MAX_MEMBERS - 1} friends. Share its code when you are ready.</Text>
      <ActionButton title={busy === "create" ? "Creating…" : "Create room"} icon="arrow-forward" disabled={busy !== null} onPress={() => void createRoom()}/>
    </Panel>

    <View style={styles.divider}><View style={styles.dividerLine}/><Text style={styles.dividerText}>OR JOIN YOUR CIRCLE</Text><View style={styles.dividerLine}/></View>

    <Panel style={styles.joinPanel}>
      <View style={styles.joinHead}><View style={styles.iconTile}><Ionicons name="enter-outline" size={25} color={color.violet}/></View><Text style={styles.panelTitle}>Join a room</Text></View>
      <Text style={styles.panelBody}>Enter the {ROOM_CODE_LENGTH}-character code or paste a Room5 invite link.</Text>
      <Field label="Room code or invite link" value={codeInput} onChangeText={(value) => { setCodeInput(value); setError(null); setFull(false); }} placeholder="e.g. A1B2C3" autoCapitalize="characters"/>
      <ActionButton title="Paste from clipboard" icon="clipboard-outline" secondary compact onPress={() => void pasteCode()}/>
      <ActionButton title={busy === "join" ? "Joining…" : "Join room"} icon="arrow-forward" disabled={busy !== null} onPress={() => void joinRoom()}/>
    </Panel>
    {error ? <View style={styles.errorWrap}><ErrorBanner message={full ? "This room already has five people. Ask the host for a different room or try later." : error}/></View> : null}
    <Text style={styles.footer}>ROOM5 · A CONVERSATION MADE FOR FIVE</Text>
    <EmojiPicker visible={emojiOpen} onClose={() => setEmojiOpen(false)} onSelect={setAvatar} title="Pick your avatar"/>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  profileButton: { padding: 3, borderRadius: 14, borderWidth: 1, borderColor: color.line },
  eyebrow: { color: color.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginTop: 42 },
  title: { color: color.text, fontSize: 36, fontWeight: "900", lineHeight: 43, marginTop: 12 },
  subtitle: { color: color.secondary, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 26 },
  createPanel: { gap: 15, borderColor: "#355897", backgroundColor: "#122444" },
  joinPanel: { gap: 16 },
  profilePanel: { gap: 16, marginBottom: 20 },
  profilePreview: { flexDirection: "row", gap: 14, alignItems: "center" },
  profileName: { color: color.text, fontSize: 18, fontWeight: "700" },
  iconTile: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#22365A", alignItems: "center", justifyContent: "center" },
  joinHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  panelTitle: { color: color.text, fontSize: 21, fontWeight: "800" },
  panelBody: { color: color.secondary, fontSize: 14, lineHeight: 21 },
  divider: { flexDirection: "row", gap: 13, alignItems: "center", marginVertical: 23 },
  dividerLine: { height: 1, flex: 1, backgroundColor: color.line },
  dividerText: { color: color.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  errorWrap: { marginTop: 16 },
  footer: { color: color.muted, textAlign: "center", fontSize: 10, letterSpacing: 1.5, marginTop: 32, marginBottom: 6 },
});
