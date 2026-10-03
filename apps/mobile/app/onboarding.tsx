import { CreateGuestSchema, GUEST_NAME_MAX } from "@room5/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSession } from "../src/session";
import { ActionButton, Avatar, Brand, color, EmojiPicker, ErrorBanner, Field, Panel, Screen } from "../src/ui";

export default function OnboardingScreen() {
  const router = useRouter();
  const { room } = useLocalSearchParams<{ room?: string }>();
  const { guest, ready, busy, createGuest } = useSession();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🚀");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && guest) router.replace(room ? { pathname: "/room/[code]", params: { code: room } } : "/lobby");
  }, [ready, guest, room, router]);

  async function continueToLobby() {
    const result = CreateGuestSchema.safeParse({ name: name.trim(), avatar });
    if (!result.success) { setError("Enter a name to continue (up to 32 characters)."); return; }
    setError(null);
    try {
      await createGuest(result.data.name, result.data.avatar);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your profile"); }
  }

  if (!ready) return <Screen><ActivityIndicator color={color.blue} style={styles.loading}/></Screen>;
  return <Screen scroll>
    <Brand caption="WELCOME TO THE CIRCLE" />
    <Text style={styles.eyebrow}>GET STARTED · 01/01</Text>
    <Text style={styles.title}>Make yourself known.</Text>
    <Text style={styles.subtitle}>Pick a name and an emoji. No account needed.</Text>
    <Panel style={styles.panel}>
      <View style={styles.preview}><Avatar avatar={avatar} name={name || "Guest"} size={76}/><Text style={styles.previewName}>{name.trim() || "Your name"}</Text></View>
      <Field label="Your display name" value={name} onChangeText={setName} placeholder="What should we call you?" maxLength={GUEST_NAME_MAX} error={error && !name.trim() ? error : null}/>
      <Text style={styles.label}>YOUR AVATAR</Text>
      <ActionButton title={avatar + "  Choose an emoji"} icon="sparkles-outline" secondary onPress={() => setEmojiOpen(true)}/>
      {error && name.trim() ? <ErrorBanner message={error}/> : null}
      <ActionButton title={busy ? "Creating profile…" : "Enter Room5"} icon="arrow-forward" disabled={busy} onPress={() => void continueToLobby()}/>
    </Panel>
    <Text style={styles.footer}>A private room holds up to five people.</Text>
    <EmojiPicker visible={emojiOpen} onClose={() => setEmojiOpen(false)} onSelect={setAvatar} title="Pick your avatar"/>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center" },
  eyebrow: { color: color.blue, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 52 },
  title: { color: color.text, fontSize: 36, lineHeight: 43, fontWeight: "900", marginTop: 14 },
  subtitle: { color: color.secondary, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 30 },
  panel: { gap: 21 },
  preview: { alignItems: "center", gap: 12, paddingVertical: 6 },
  previewName: { color: color.text, fontSize: 20, fontWeight: "800" },
  label: { color: color.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginBottom: -12 },
  footer: { color: color.muted, textAlign: "center", marginTop: 25, fontSize: 12 },
});
