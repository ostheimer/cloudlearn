/**
 * Zwischenlager für den Wunschnamen aus der Registrierung.
 *
 * Zwischen "Name eingetippt" und "erste echte Anmeldung" kann die
 * E-Mail-Bestätigung liegen — solange gibt es keine Sitzung, mit der sich
 * der Name speichern ließe. Der Wert wartet deshalb in AsyncStorage; die
 * einmalige Abfrage (DisplayNamePrompt) versucht ihn nach der Anmeldung
 * erst still zu speichern und fragt nur nach, wenn der Server ihn ablehnt.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_KEY = "clearn.pendingDisplayName";

export async function rememberPendingDisplayName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, name);
  } catch {
    // Speicher nicht verfügbar: dann fragt der Dialog einfach nach.
  }
}

export async function readPendingDisplayName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingDisplayName(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Aufräumen darf still scheitern.
  }
}
