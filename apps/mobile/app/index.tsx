import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSession } from "../src/session";
import { ActionButton, Brand, color, ErrorBanner, Screen } from "../src/ui";

export default function HomeScreen() {
  const router = useRouter();
  const { guest, ready, error, restore } = useSession();
  useEffect(() => {
    if (ready && !error) router.replace(guest ? "/lobby" : "/onboarding");
  }, [ready, error, guest, router]);

  return <Screen>
    <View style={styles.center}>
      <Brand caption="YOUR SPACE. YOUR PEOPLE." />
      <Text style={styles.title}>A room for your circle.</Text>
      <Text style={styles.subtitle}>Five people. One conversation. Infinite possibilities.</Text>
      {error ? <View style={styles.retry}><ErrorBanner message={error}/><ActionButton title="Try again" icon="refresh" onPress={() => void restore()}/></View>
        : <ActivityIndicator color={color.blue} size="large" style={styles.loader}/>}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 30, justifyContent: "center", alignItems: "center" },
  title: { marginTop: 38, fontSize: 34, fontWeight: "900", color: color.text, textAlign: "center", lineHeight: 41 },
  subtitle: { marginTop: 14, color: color.secondary, textAlign: "center", lineHeight: 22, fontSize: 15 },
  loader: { marginTop: 42 },
  retry: { marginTop: 36, width: "100%", gap: 14 },
});
