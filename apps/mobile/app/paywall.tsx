import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePaywallState } from "../src/features/paywall/paywallState";

export default function PaywallScreen() {
  const router = useRouter();
  const upgrade = usePaywallState((state) => state.upgrade);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, gap: 12, padding: 16, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Upgrade erforderlich</Text>
        <Text>Dein Free-Limit wurde erreicht. Waehle einen Plan:</Text>
        <Button title="Pro (Monat)" onPress={() => upgrade("pro")} />
        <Button title="Lifetime" onPress={() => upgrade("lifetime")} />
        <Button title="Zurueck" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
