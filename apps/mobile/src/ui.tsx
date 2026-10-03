import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const color = {
  bg: "#080D17", surface: "#101A2B", raised: "#17243A", line: "#263B5B",
  text: "#F0F4FA", secondary: "#A3B8D5", muted: "#6F87AC",
  blue: "#4D8DFF", violet: "#8B5CF6", success: "#35D19A", warning: "#F6B94D", danger: "#FF6B82",
};

export const emojiChoices = [
  "😀", "😎", "🥳", "🤖", "👾", "🚀", "🌌", "⚡", "🔥", "💎", "🌙", "⭐",
  "🦊", "🐼", "🐯", "🐸", "🐙", "🦄", "👑", "🎧", "🎮", "🎨", "🍀", "🌈",
  "😂", "😍", "🙏", "💙", "❤️", "✨", "👍", "🎉", "😮", "😅", "🙌", "🤝",
  "🌻", "🍕", "☕", "🛸", "🦋", "🐱", "💡", "💬", "🎵", "😴", "😈", "🫶",
];

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const content = scroll
    ? <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={styles.screenContent}>{children}</View>;
  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
    <LinearGradient colors={["#0B1630", color.bg, "#120F2A"]} style={StyleSheet.absoluteFill} />
    <View style={styles.glowOne} pointerEvents="none" />
    <View style={styles.glowTwo} pointerEvents="none" />
    {content}
  </SafeAreaView>;
}

export function Brand({ caption }: { caption?: string }) {
  return <View style={styles.brandRow}>
    <LinearGradient colors={[color.blue, color.violet]} style={styles.brandMark}>
      <Ionicons name="chatbubbles" size={22} color="#fff" />
    </LinearGradient>
    <View>
      <Text style={styles.brandName}>ROOM<Text style={{ color: color.blue }}>5</Text></Text>
      {caption ? <Text style={styles.brandCaption}>{caption}</Text> : null}
    </View>
  </View>;
}

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function ActionButton({ title, onPress, icon, secondary = false, disabled = false, compact = false }: {
  title: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap;
  secondary?: boolean; disabled?: boolean; compact?: boolean;
}) {
  return <Pressable
    onPress={onPress} disabled={disabled}
    accessibilityRole="button" accessibilityLabel={title}
    style={({ pressed }) => [styles.button, compact && styles.buttonCompact, secondary && styles.buttonSecondary, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.75 }]}
  >
    {secondary ? <View style={styles.buttonInner}>{icon ? <Ionicons name={icon} size={19} color={color.text} /> : null}<Text style={styles.buttonSecondaryText}>{title}</Text></View>
      : <LinearGradient colors={[color.blue, color.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
          {icon ? <Ionicons name={icon} size={19} color="#fff" /> : null}<Text style={styles.buttonText}>{title}</Text>
        </LinearGradient>}
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, maxLength, autoCapitalize = "sentences", multiline = false, error }: {
  label?: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  maxLength?: number; autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean; error?: string | null;
}) {
  return <View style={styles.fieldWrap}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={color.muted} selectionColor={color.blue} maxLength={maxLength}
      autoCapitalize={autoCapitalize} multiline={multiline} autoCorrect={autoCapitalize !== "characters"}
      style={[styles.field, multiline && { minHeight: 78, textAlignVertical: "top" }, error && { borderColor: color.danger }]}/>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

export function Avatar({ avatar, name, size = 44 }: { avatar: string; name: string; size?: number }) {
  const shown = avatar || name.slice(0, 2).toUpperCase();
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.32 }]} accessibilityLabel={`${name}'s avatar`}>
    <Text style={{ fontSize: size * (shown.length > 2 ? 0.38 : 0.43), color: color.text, fontWeight: "700" }} numberOfLines={1}>{shown}</Text>
  </View>;
}

export function EmojiPicker({ visible, onClose, onSelect, title = "Choose an emoji" }: {
  visible: boolean; onClose: () => void; onSelect: (emoji: string) => void; title?: string;
}) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.scrim} onPress={onClose} />
    <SafeAreaView edges={["bottom"]} style={styles.emojiSheet}>
      <View style={styles.emojiHeader}>
        <Text style={styles.emojiTitle}>{title}</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close emoji picker"><Ionicons name="close" size={24} color={color.secondary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.emojiGrid}>
        {emojiChoices.map((emoji) => <Pressable key={emoji} onPress={() => { onSelect(emoji); onClose(); }} accessibilityLabel={`Select ${emoji}`} style={styles.emojiCell}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </Pressable>)}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={color.danger}/><Text style={styles.errorBannerText}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenContent: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  glowOne: { position: "absolute", top: -90, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: "#142D61", opacity: 0.4 },
  glowTwo: { position: "absolute", bottom: 80, left: -130, width: 260, height: 260, borderRadius: 130, backgroundColor: "#2E1C5E", opacity: 0.24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: { width: 46, height: 46, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  brandName: { fontSize: 22, letterSpacing: 2, fontWeight: "900", color: color.text },
  brandCaption: { color: color.muted, fontSize: 10, letterSpacing: 1.3, fontWeight: "700" },
  panel: { backgroundColor: "#111B2D", borderColor: color.line, borderWidth: 1, borderRadius: 26, padding: 22, overflow: "hidden" },
  button: { borderRadius: 17, overflow: "hidden", minHeight: 55 },
  buttonCompact: { minHeight: 43 },
  buttonSecondary: { backgroundColor: color.raised, borderWidth: 1, borderColor: color.line },
  buttonGradient: { flex: 1, minHeight: 55, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 18 },
  buttonInner: { flex: 1, minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 18 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  buttonSecondaryText: { color: color.text, fontSize: 15, fontWeight: "700" },
  fieldWrap: { gap: 9 },
  label: { color: color.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  field: { backgroundColor: "#0B1425", borderColor: color.line, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, color: color.text, fontSize: 16, minHeight: 52 },
  error: { color: color.danger, fontSize: 12 },
  avatar: { alignItems: "center", justifyContent: "center", backgroundColor: "#243B66", borderWidth: 1, borderColor: "#4A6EA8" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.65)" },
  emojiSheet: { backgroundColor: color.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "55%", borderColor: color.line, borderWidth: 1 },
  emojiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingTop: 20, paddingBottom: 12 },
  emojiTitle: { color: color.text, fontWeight: "800", fontSize: 18 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, paddingHorizontal: 14, paddingBottom: 18 },
  emojiCell: { width: 49, height: 49, alignItems: "center", justifyContent: "center", backgroundColor: color.raised, borderRadius: 13 },
  emojiText: { fontSize: 26 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#3B1B31", borderRadius: 13, padding: 12, borderWidth: 1, borderColor: "#803C56" },
  errorBannerText: { color: "#FFC5CF", flex: 1, fontSize: 13, lineHeight: 18 },
});
