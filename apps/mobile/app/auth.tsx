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
import { BookOpen } from "lucide-react-native";
import { useSessionStore } from "../src/store/sessionStore";
import { colors, spacing, radius, typography } from "../src/theme";

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

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: typography.base,
    color: colors.text,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Branding */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.lg,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <BookOpen size={36} color={colors.primary} />
            </View>
            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              clearn
            </Text>
            <Text
              style={{
                fontSize: typography.base,
                color: colors.textSecondary,
                marginTop: spacing.xs,
              }}
            >
              Foto — Flashcards — Wissen
            </Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
              marginBottom: spacing.xxl,
              textAlign: "center",
            }}
          >
            {titles[mode]}
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                marginBottom: spacing.sm,
                fontWeight: typography.semibold,
              }}
            >
              E-Mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="deine@email.de"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
          </View>

          {/* Password */}
          {mode !== "reset" && (
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginBottom: spacing.sm,
                  fontWeight: typography.semibold,
                }}
              >
                Passwort
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={inputStyle}
              />
            </View>
          )}

          {/* Confirm Password */}
          {mode === "register" && (
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginBottom: spacing.sm,
                  fontWeight: typography.semibold,
                }}
              >
                Passwort bestätigen
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={inputStyle}
              />
            </View>
          )}

          {/* Forgot Password link */}
          {mode === "login" && (
            <TouchableOpacity
              onPress={() => setMode("reset")}
              style={{ alignSelf: "flex-end", marginBottom: spacing.xl }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.sm + 1,
                  fontWeight: typography.medium,
                }}
              >
                Passwort vergessen?
              </Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: loading
                ? colors.textTertiary
                : colors.primary,
              borderRadius: radius.md,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: mode === "login" ? 0 : spacing.sm,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                }}
              >
                {buttonLabels[mode]}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode switch */}
          <View style={{ marginTop: spacing.xxl, alignItems: "center" }}>
            {mode === "login" ? (
              <TouchableOpacity onPress={() => setMode("register")}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.base,
                  }}
                >
                  Noch kein Konto?{" "}
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Registrieren
                  </Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setMode("login")}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.base,
                  }}
                >
                  Bereits ein Konto?{" "}
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Anmelden
                  </Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
