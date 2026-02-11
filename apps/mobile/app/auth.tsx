import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionStore } from "../src/store/sessionStore";

type AuthMode = "login" | "register" | "reset";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = useSessionStore((state) => state.signIn);
  const signUp = useSessionStore((state) => state.signUp);
  const resetPassword = useSessionStore((state) => state.resetPassword);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Fehler", "Bitte E-Mail-Adresse eingeben.");
      return;
    }

    if (mode !== "reset" && !password) {
      Alert.alert("Fehler", "Bitte Passwort eingeben.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      Alert.alert("Fehler", "Passwörter stimmen nicht überein.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      Alert.alert("Fehler", "Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) Alert.alert("Login fehlgeschlagen", error);
      } else if (mode === "register") {
        const { error } = await signUp(email, password);
        if (error) {
          Alert.alert("Registrierung fehlgeschlagen", error);
        } else {
          Alert.alert(
            "Bestätigung gesendet",
            "Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte klicke auf den Link, um dein Konto zu aktivieren.",
            [{ text: "OK", onPress: () => setMode("login") }]
          );
        }
      } else {
        const { error } = await resetPassword(email);
        if (error) {
          Alert.alert("Fehler", error);
        } else {
          Alert.alert(
            "E-Mail gesendet",
            "Falls ein Konto mit dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen.",
            [{ text: "OK", onPress: () => setMode("login") }]
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login: "Willkommen zurück",
    register: "Konto erstellen",
    reset: "Passwort zurücksetzen",
  };

  const buttonLabels: Record<AuthMode, string> = {
    login: "Anmelden",
    register: "Registrieren",
    reset: "Link senden",
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Branding */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🧠</Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#111827" }}>
              clearn
            </Text>
            <Text style={{ fontSize: 15, color: "#6b7280", marginTop: 4 }}>
              Foto → Flashcards → Wissen
            </Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            {titles[mode]}
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 6, fontWeight: "600" }}>
              E-Mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="deine@email.de"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#d1d5db",
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
              }}
            />
          </View>

          {/* Password */}
          {mode !== "reset" && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 6, fontWeight: "600" }}>
                Passwort
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                }}
              />
            </View>
          )}

          {/* Confirm Password (Register only) */}
          {mode === "register" && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 6, fontWeight: "600" }}>
                Passwort bestätigen
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                }}
              />
            </View>
          )}

          {/* Forgot Password link (Login only) */}
          {mode === "login" && (
            <TouchableOpacity
              onPress={() => setMode("reset")}
              style={{ alignSelf: "flex-end", marginBottom: 20 }}
            >
              <Text style={{ color: "#6366f1", fontSize: 14, fontWeight: "500" }}>
                Passwort vergessen?
              </Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#9ca3af" : "#6366f1",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginTop: mode === "login" ? 0 : 8,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                {buttonLabels[mode]}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode switch */}
          <View style={{ marginTop: 24, alignItems: "center" }}>
            {mode === "login" ? (
              <TouchableOpacity onPress={() => setMode("register")}>
                <Text style={{ color: "#6b7280", fontSize: 15 }}>
                  Noch kein Konto?{" "}
                  <Text style={{ color: "#6366f1", fontWeight: "600" }}>Registrieren</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setMode("login")}>
                <Text style={{ color: "#6b7280", fontSize: 15 }}>
                  Bereits ein Konto?{" "}
                  <Text style={{ color: "#6366f1", fontWeight: "600" }}>Anmelden</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
