/**
 * Einmalige Namensabfrage für Konten ohne Anzeigenamen — App-Hälfte des
 * Namens-Features (Web-Gegenstück: apps/web .../display-name-prompt.tsx).
 *
 * Ablauf wie im Web: Erst wird ein hinterlegter Wunschname aus der
 * Registrierung STILL gespeichert (der Dialog blitzt dann gar nicht auf);
 * nur wenn keiner da ist oder der Server ihn ablehnt, fragt das Blatt nach.
 * Wegtippen ist erlaubt — beim nächsten App-Start fragt es wieder, solange
 * kein Name gesetzt ist. Bei Netzfehlern beim Laden bleibt es still.
 */
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { UserRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import TextPromptModal from "./TextPromptModal";
import { getProfile, updateDisplayName, displayNameErrorKey } from "../lib/api";
import {
  readPendingDisplayName,
  clearPendingDisplayName,
} from "../lib/displayNamePending";
import { useSessionStore } from "../store/sessionStore";

export function DisplayNamePrompt() {
  const userId = useSessionStore((s) => s.userId);
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [initialValue, setInitialValue] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const profile = await getProfile();
        if (!active || profile.displayName) return;

        const pending = await readPendingDisplayName();
        if (pending) {
          try {
            await updateDisplayName(pending);
            await clearPendingDisplayName();
            return; // still gespeichert — kein Dialog nötig
          } catch {
            if (!active) return;
            setInitialValue(pending); // abgelehnt: vorbefüllt nachfragen
          }
        }
        if (active) setVisible(true);
      } catch {
        // Profil nicht ladbar (Netz): nicht blockieren, nächster Start fragt.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const handleSubmit = async (value: string) => {
    try {
      await updateDisplayName(value);
      await clearPendingDisplayName();
      setVisible(false);
    } catch (error) {
      // Blatt bleibt offen, der Wert steht noch im Feld — nur erklären, warum.
      Alert.alert(t("displayName.errorTitle"), t(displayNameErrorKey(error)));
    }
  };

  return (
    <TextPromptModal
      visible={visible}
      title={t("displayName.title")}
      label={t("displayName.label")}
      placeholder={t("displayName.placeholder")}
      initialValue={initialValue}
      confirmLabel={t("displayName.save")}
      icon={UserRound}
      onCancel={() => setVisible(false)}
      onSubmit={(value) => {
        void handleSubmit(value);
      }}
    />
  );
}
