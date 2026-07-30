import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Apple } from "lucide-react-native";
import { useSessionStore } from "../src/store/sessionStore";
import { spacing, radius, typography } from "../src/theme";
import { getAuthProviderAvailability } from "../src/lib/supabase";
import {
  rememberPendingDisplayName,
  rememberPendingGender,
} from "../src/lib/displayNamePending";
import type { Gender } from "../src/lib/api";

type AuthMode = "login" | "register" | "reset";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "female", label: "Weiblich" },
  { value: "male", label: "Männlich" },
  { value: "diverse", label: "Divers" },
];

const webFormStyle = {
  display: "flex",
  flexDirection: "column",
} satisfies CSSProperties;

function FormContainer({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => void;
}) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <form
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      style={webFormStyle}
    >
      {children}
    </form>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const brandBackground = "#4F46E5";
  const brandSurface = "rgba(15, 23, 42, 0.18)";
  const brandBorder = "rgba(255, 255, 255, 0.18)";
  const brandText = "#FFFFFF";
  const brandTextSecondary = "rgba(255, 255, 255, 0.78)";
  const brandTextTertiary = "rgba(255, 255, 255, 0.56)";
  const brandButtonBackground = "#EEF2FF";
  const brandButtonText = "#312E81";
  const brandLink = "#E0E7FF";
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null
  );
  const [availableProviders, setAvailableProviders] = useState({
    google: false,
    apple: false,
  });
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const signIn = useSessionStore((state) => state.signIn);
  const signInWithOAuth = useSessionStore((state) => state.signInWithOAuth);
  const signUp = useSessionStore((state) => state.signUp);
  const resetPassword = useSessionStore((state) => state.resetPassword);

  useEffect(() => {
    let active = true;

    void getAuthProviderAvailability().then((providers) => {
      if (!active) {
        return;
      }

      setAvailableProviders({
        google: providers.google,
        apple: providers.apple,
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const handleOAuth = async (provider: "google" | "apple") => {
    if (!availableProviders[provider]) {
      const providerLabel = provider === "google" ? "Google" : "Apple";
      Alert.alert(
        `${providerLabel}-Login wird noch freigeschaltet`,
        `${providerLabel} ist in Supabase für dieses Projekt noch nicht aktiviert. E-Mail und Passwort funktionieren bereits.`
      );
      return;
    }

    // Google/Apple auf der Registrierungsseite dürfen die beiden Pflichtfelder
    // nicht umgehen (wie im Web). Beim Login bleibt alles wie bisher.
    if (mode === "register") {
      if (displayName.trim().length < 2) {
        Alert.alert("Fehler", "Bitte gib deinen Namen ein (mindestens 2 Zeichen).");
        return;
      }
      if (!gender) {
        Alert.alert("Fehler", "Bitte wähle aus, wie clearn dich nennen soll.");
        return;
      }
      // Nach dem Provider-Redirect speichert die Namensabfrage beide Angaben
      // über den geprüften Profil-Endpunkt. Das muss vor dem Redirect passieren.
      await rememberPendingDisplayName(displayName.trim());
      await rememberPendingGender(gender);
    }

    setOauthLoading(provider);
    try {
      const { error, cancelled } = await signInWithOAuth(provider);
      if (!cancelled && error) {
        if (error.toLowerCase().includes("unsupported provider")) {
          Alert.alert(
            "Anbieter noch nicht aktiv",
            "Google- oder Apple-Login ist für dieses Projekt noch nicht freigeschaltet. Nutze vorerst E-Mail und Passwort."
          );
          return;
        }
        Alert.alert("Login fehlgeschlagen", error);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (mode === "register" && displayName.trim().length < 2) {
      Alert.alert("Fehler", "Bitte gib deinen Namen ein (mindestens 2 Zeichen).");
      return;
    }

    if (mode === "register" && !gender) {
      Alert.alert("Fehler", "Bitte wähle aus, wie clearn dich nennen soll.");
      return;
    }

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
        if (error) {
          Alert.alert("Login fehlgeschlagen", error);
        }
      } else if (mode === "register") {
        const { error, requiresEmailConfirmation } = await signUp(email, password);
        if (error) {
          Alert.alert("Registrierung fehlgeschlagen", error);
        } else {
          // Wunschname und Geschlecht zwischenlagern — gespeichert (und geprüft)
          // wird beides nach der ersten Anmeldung von der Abfrage auf dem Home-Tab.
          await rememberPendingDisplayName(displayName.trim());
          if (gender) await rememberPendingGender(gender);
          if (requiresEmailConfirmation) {
            Alert.alert(
              "Bestätigung gesendet",
              "Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte prüfe auch Spam oder Werbung und klicke auf den Link, um dein Konto zu aktivieren.",
              [{ text: "OK", onPress: () => setMode("login") }]
            );
          } else {
            router.replace("/(tabs)");
          }
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

  const isCompactHeight = Platform.OS !== "web" && windowHeight <= 900;
  const contentPadding = isCompactHeight ? spacing.md : spacing.xxl;
  const logoSize = isCompactHeight ? 120 : 208;
  const heroSpacing = isCompactHeight ? spacing.md : 40;
  const oauthButtonPaddingVertical = isCompactHeight ? 10 : 14;
  const inputPaddingVertical = isCompactHeight ? 10 : 14;
  const inputGroupSpacing = isCompactHeight ? spacing.sm : 14;
  const sectionSpacing = isCompactHeight ? spacing.md : spacing.xl;
  const submitPaddingVertical = isCompactHeight ? 13 : 16;
  const footerSpacing = isCompactHeight ? spacing.md : spacing.xxl;
  const titleFontSize = isCompactHeight ? typography.xl : typography.xxl;
  const fieldLabelMarginBottom = isCompactHeight ? spacing.xs + 2 : spacing.sm;
  const secondaryLinkFontSize = isCompactHeight ? typography.sm : typography.base;

  const inputStyle = {
    backgroundColor: brandSurface,
    borderWidth: 1,
    borderColor: brandBorder,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: inputPaddingVertical,
    fontSize: typography.base,
    color: brandText,
  } as const;

  const webSubmitStyle: CSSProperties = {
    appearance: "none",
    backgroundColor: loading ? "rgba(238, 242, 255, 0.5)" : brandButtonBackground,
    border: "none",
    borderRadius: radius.md,
    color: brandButtonText,
    cursor: loading ? "default" : "pointer",
    fontSize: typography.lg,
    fontWeight: typography.bold,
    marginTop: mode === "login" ? 0 : spacing.sm,
    paddingBlock: 16,
    width: "100%",
  };

  const isBusy = loading || oauthLoading !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brandBackground }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: isCompactHeight ? "flex-start" : "center",
            alignItems: "center",
            paddingHorizontal: contentPadding,
            paddingTop: isCompactHeight ? spacing.sm : spacing.xxl,
            paddingBottom: contentPadding,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 440,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: heroSpacing }}>
              <Image
                source={require("../assets/brand-mark.png")}
                style={{
                  width: logoSize,
                  height: logoSize,
                  marginBottom: isCompactHeight ? 0 : spacing.sm,
                }}
                resizeMode="contain"
              />
              <Text
                style={{
                  fontSize: isCompactHeight ? typography.xs : typography.base,
                  color: brandTextSecondary,
                  marginTop: isCompactHeight ? 2 : spacing.xs,
                }}
              >
                Foto — Flashcards — Wissen
              </Text>
            </View>

            <FormContainer
              onSubmit={() => {
                void handleSubmit();
              }}
            >
              <Text
                style={{
                  fontSize: titleFontSize,
                  fontWeight: typography.bold,
                  color: brandText,
                  marginBottom: sectionSpacing,
                  textAlign: "center",
                }}
              >
                {titles[mode]}
              </Text>

              {mode !== "reset" ? (
                <>
                  <View style={{ gap: spacing.sm, marginBottom: sectionSpacing }}>
                    <TouchableOpacity
                      onPress={() => {
                        void handleOAuth("google");
                      }}
                      disabled={isBusy}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: brandSurface,
                        borderRadius: radius.md,
                        paddingVertical: oauthButtonPaddingVertical,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: brandBorder,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        opacity: isBusy ? 0.72 : 1,
                      }}
                    >
                      {oauthLoading === "google" ? (
                        <ActivityIndicator color={brandText} />
                      ) : (
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "900",
                              color: "#EA4335",
                            }}
                          >
                            G
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{
                          color: brandText,
                          fontSize: isCompactHeight ? typography.sm : typography.base,
                          fontWeight: typography.semibold,
                        }}
                      >
                        {oauthLoading === "google"
                          ? "Google wird geöffnet ..."
                          : "Mit Google fortfahren"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        void handleOAuth("apple");
                      }}
                      disabled={isBusy}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: brandSurface,
                        borderRadius: radius.md,
                        paddingVertical: oauthButtonPaddingVertical,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: brandBorder,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        opacity: isBusy ? 0.72 : 1,
                      }}
                    >
                      {oauthLoading === "apple" ? (
                        <ActivityIndicator color={brandText} />
                      ) : (
                        <Apple size={18} color={brandText} />
                      )}
                      <Text
                        style={{
                          color: brandText,
                          fontSize: isCompactHeight ? typography.sm : typography.base,
                          fontWeight: typography.semibold,
                        }}
                      >
                        {oauthLoading === "apple"
                          ? "Apple wird geöffnet ..."
                          : "Mit Apple fortfahren"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      marginBottom: isCompactHeight ? spacing.md : spacing.lg,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: brandBorder,
                      }}
                    />
                    <Text
                      style={{
                        color: brandTextTertiary,
                        fontSize: isCompactHeight ? typography.xs : typography.sm,
                        fontWeight: typography.semibold,
                      }}
                    >
                      oder mit E-Mail
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        height: 1,
                        backgroundColor: brandBorder,
                      }}
                    />
                  </View>
                </>
              ) : null}

              {mode === "register" ? (
                <View style={{ marginBottom: inputGroupSpacing }}>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: brandTextSecondary,
                      marginBottom: fieldLabelMarginBottom,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Dein Name
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="So sehen dich andere Lernende"
                    placeholderTextColor={brandTextTertiary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="name"
                    textContentType="nickname"
                    maxLength={20}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      emailInputRef.current?.focus();
                    }}
                    onKeyPress={(event) => {
                      if (Platform.OS !== "web" || event.nativeEvent.key !== "Enter") {
                        return;
                      }
                      emailInputRef.current?.focus();
                    }}
                    style={inputStyle}
                  />
                </View>
              ) : null}

              {mode === "register" ? (
                <View style={{ marginBottom: inputGroupSpacing }}>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: brandTextSecondary,
                      marginBottom: fieldLabelMarginBottom,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Geschlecht
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {GENDER_OPTIONS.map((opt) => {
                      const selected = gender === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setGender(opt.value)}
                          disabled={isBusy}
                          activeOpacity={0.8}
                          style={{
                            flex: 1,
                            backgroundColor: selected ? brandButtonBackground : brandSurface,
                            borderWidth: 1,
                            borderColor: selected ? brandButtonBackground : brandBorder,
                            borderRadius: radius.md,
                            paddingVertical: inputPaddingVertical,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: typography.sm,
                              fontWeight: typography.semibold,
                              color: selected ? brandButtonText : brandText,
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: brandTextTertiary,
                      marginTop: spacing.xs,
                    }}
                  >
                    Damit dich clearn bei Freunden richtig nennt.
                  </Text>
                </View>
              ) : null}

              <View style={{ marginBottom: inputGroupSpacing }}>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: brandTextSecondary,
                    marginBottom: fieldLabelMarginBottom,
                    fontWeight: typography.semibold,
                  }}
                >
                  E-Mail
                </Text>
                <TextInput
                  ref={emailInputRef}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="deine@email.de"
                  placeholderTextColor={brandTextTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType={mode === "reset" ? "send" : "next"}
                  onSubmitEditing={() => {
                    if (mode === "reset") {
                      void handleSubmit();
                      return;
                    }
                    passwordInputRef.current?.focus();
                  }}
                  onKeyPress={(event) => {
                    if (Platform.OS !== "web" || event.nativeEvent.key !== "Enter") {
                      return;
                    }
                    if (mode === "reset") {
                      void handleSubmit();
                      return;
                    }
                    passwordInputRef.current?.focus();
                  }}
                  style={inputStyle}
                />
              </View>

              {mode !== "reset" ? (
                <View style={{ marginBottom: inputGroupSpacing }}>
                  <Text
                    style={{
                      color: brandTextSecondary,
                      fontSize: typography.sm,
                      marginBottom: fieldLabelMarginBottom,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Passwort
                  </Text>
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={brandTextTertiary}
                    secureTextEntry
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    textContentType={mode === "login" ? "password" : "newPassword"}
                    returnKeyType={mode === "register" ? "next" : "go"}
                    onSubmitEditing={() => {
                      if (mode === "register") {
                        confirmPasswordInputRef.current?.focus();
                        return;
                      }
                      void handleSubmit();
                    }}
                    onKeyPress={(event) => {
                      if (Platform.OS !== "web" || event.nativeEvent.key !== "Enter") {
                        return;
                      }
                      if (mode === "register") {
                        confirmPasswordInputRef.current?.focus();
                        return;
                      }
                      void handleSubmit();
                    }}
                    style={inputStyle}
                  />
                </View>
              ) : null}

              {mode === "register" ? (
                <View style={{ marginBottom: inputGroupSpacing }}>
                  <Text
                    style={{
                      color: brandTextSecondary,
                      fontSize: typography.sm,
                      marginBottom: fieldLabelMarginBottom,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Passwort bestätigen
                  </Text>
                  <TextInput
                    ref={confirmPasswordInputRef}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={brandTextTertiary}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={() => {
                      void handleSubmit();
                    }}
                    onKeyPress={(event) => {
                      if (Platform.OS !== "web" || event.nativeEvent.key !== "Enter") {
                        return;
                      }
                      void handleSubmit();
                    }}
                    style={inputStyle}
                  />
                </View>
              ) : null}

              {mode === "login" ? (
                <TouchableOpacity
                  onPress={() => setMode("reset")}
                  disabled={isBusy}
                  style={{
                    alignSelf: "flex-end",
                    marginBottom: sectionSpacing,
                  }}
                >
                  <Text
                    style={{
                      color: brandLink,
                      fontSize: isCompactHeight ? typography.sm : typography.sm + 1,
                      fontWeight: typography.medium,
                    }}
                  >
                    Passwort vergessen?
                  </Text>
                </TouchableOpacity>
              ) : null}

              {Platform.OS === "web" ? (
                <button type="submit" disabled={isBusy} style={webSubmitStyle}>
                  {loading ? "Wird verarbeitet ..." : buttonLabels[mode]}
                </button>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    void handleSubmit();
                  }}
                  disabled={isBusy}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isBusy
                      ? "rgba(238, 242, 255, 0.5)"
                      : brandButtonBackground,
                    borderRadius: radius.md,
                    paddingVertical: submitPaddingVertical,
                    alignItems: "center",
                    marginTop: mode === "login" ? 0 : spacing.sm,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color={brandButtonText} />
                  ) : (
                    <Text
                      style={{
                        color: brandButtonText,
                        fontSize: isCompactHeight ? typography.base : typography.lg,
                        fontWeight: typography.bold,
                      }}
                    >
                      {buttonLabels[mode]}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={{ marginTop: footerSpacing, alignItems: "center" }}>
                {mode === "login" ? (
                  <TouchableOpacity onPress={() => setMode("register")} disabled={isBusy}>
                    <Text
                      style={{
                        color: brandTextSecondary,
                        fontSize: secondaryLinkFontSize,
                      }}
                    >
                      Noch kein Konto?{" "}
                      <Text
                        style={{
                          color: brandLink,
                          fontWeight: typography.semibold,
                        }}
                      >
                        Registrieren
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setMode("login")} disabled={isBusy}>
                    <Text
                      style={{
                        color: brandTextSecondary,
                        fontSize: secondaryLinkFontSize,
                      }}
                    >
                      Bereits ein Konto?{" "}
                      <Text
                        style={{
                          color: brandLink,
                          fontWeight: typography.semibold,
                        }}
                      >
                        Anmelden
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {mode === "login" ? (
                <TouchableOpacity
                  onPress={() => router.replace("/(tabs)")}
                  disabled={isBusy}
                  style={{ marginTop: spacing.lg, alignItems: "center" }}
                >
                  <Text
                    style={{
                      color: brandTextSecondary,
                      fontSize: secondaryLinkFontSize,
                    }}
                  >
                    Erst einmal ohne Login starten
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Face ID/Touch ID gibt es nur bei Apple — auf Android und im
                  Browser wäre der Satz eine leere Behauptung (#609). */}
              {mode === "login" && Platform.OS === "ios" ? (
                <Text
                  style={{
                    color: brandTextTertiary,
                    fontSize: typography.xs,
                    lineHeight: 18,
                    marginTop: spacing.md,
                    textAlign: "center",
                  }}
                >
                  Nach dem Login kannst du clearn auf diesem Gerät mit Face ID
                  oder Touch ID entsperren.
                </Text>
              ) : null}
            </FormContainer>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
