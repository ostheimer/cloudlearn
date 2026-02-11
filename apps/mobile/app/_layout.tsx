import { Slot } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeI18n } from "../src/i18n";
import { useSessionStore } from "../src/store/sessionStore";

initializeI18n("de");

const DEMO_USER_ID = "11111111-2222-4222-8222-555555555555";

export default function RootLayout() {
  const signIn = useSessionStore((state) => state.signIn);

  useEffect(() => {
    signIn(DEMO_USER_ID);
  }, []);

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
