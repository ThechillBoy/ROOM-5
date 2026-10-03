import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, Brand, color, Screen } from "../src/ui";

export default function NotFoundScreen() {
  const router = useRouter();
  return <Screen>
    <View style={styles.wrap}>
      <Brand caption="PRIVATE SPACE · FIVE SEATS"/>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>This room is off the map.</Text>
      <Text style={styles.body}>The link does not lead to a Room5 screen.</Text>
      <ActionButton title="Go to Room5" icon="arrow-forward" onPress={() => router.replace("/")}/>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 28, justifyContent: "center", gap: 15 },
  code: { color: color.blue, fontSize: 67, fontWeight: "900", letterSpacing: 5, marginTop: 26 },
  title: { color: color.text, fontSize: 29, fontWeight: "900" },
  body: { color: color.secondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
});
