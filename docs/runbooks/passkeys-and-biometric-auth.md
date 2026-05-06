# Passkeys und Face ID

Stand: 2026-05-06

## Ziel

Diese Datei trennt zwei bewusst unterschiedliche Sicherheitsfunktionen:

- **Face ID / Touch ID zum Entsperren:** lokaler Schutz einer bestehenden
  angemeldeten Session auf dem Gerät.
- **Passkeys:** kontoübergreifender Login über WebAuthn/FIDO2, bei dem der
  Server eine kryptografische Signatur prüft.

## Aktueller v1-Stand

### Umgesetzt

- Face ID / Touch ID kann im Profil aktiviert werden.
- Nach Aktivierung sperrt clearn die App beim Öffnen bzw. nach App-Wechseln.
- Die Entsperrung nutzt `expo-local-authentication`.
- Supabase-Auth-Sessions werden auf nativen Geräten über `expo-secure-store`
  im iOS Keychain / Android Keystore gespeichert.
- Bestehende AsyncStorage-Sessions werden beim nächsten Lesen automatisch in
  SecureStore migriert.
- Es werden keine E-Mail-Passwörter lokal gespeichert.

### Nicht umgesetzt

- Echter nativer Passkey-Login ist noch nicht aktiv.
- clearn zeigt keinen Passkey-Button, solange der Backend-/Provider-Pfad nicht
  final verifiziert ist.

## Warum Face ID kein Passkey ist

Face ID beantwortet lokal die Frage: „Darf diese Person diese App auf diesem
Gerät öffnen?“

Ein Passkey beantwortet serverseitig die Frage: „Kann diese Person kryptografisch
beweisen, dass sie den privaten Schlüssel für dieses Konto besitzt?“

Deshalb wäre es unsicher, einen Passkey-Login nur über lokale Face-ID-Prüfung zu
simulieren oder ein Passwort im Keychain zu speichern und nach Face ID automatisch
einzugeben.

## Passkey-Implementierungsoptionen

### Option A — Supabase Passkeys, wenn für Native stabil verfügbar

Vorteile:

- Gleicher Auth-Provider wie E-Mail, Google und Apple.
- Identitäten bleiben zentral in Supabase.
- Weniger eigene Security-Oberfläche.

Risiken:

- Supabase Passkey/WebAuthn-Flows sind SDK- und Plattform-abhängig.
- WebAuthn nutzt im Browser `navigator.credentials`; native React-Native-iOS-
  Unterstützung muss separat verifiziert werden.
- Deep Links, Associated Domains und Identity Linking müssen sehr sauber sitzen.

Empfehlung: Erst in einem separaten Spike gegen einen echten iOS-Build testen.

### Option B — Nativer iOS-Passkey-Provider plus eigener API-Verify-Flow

Vorteile:

- Voll native iOS-Erfahrung über Apples AuthenticationServices.
- Gute Nutzererwartung im App-Store-Kontext.

Risiken:

- Mehr Implementierungsaufwand.
- Server-Challenge, Credential-Registrierung, Credential-Assertion und Replay-
  Schutz müssen korrekt gebaut und getestet werden.
- Expo Managed/Prebuild braucht ein passendes Native-Modul oder eigenen
  Config-/Native-Code.

Empfehlung: Nur wählen, wenn Passkeys v1-kritisch sind.

## Empfohlener Launch-Default

Für den ersten TestFlight/App-Store-Release:

1. E-Mail/Passwort, Apple Sign-In und Google Sign-In als Konto-Login.
2. Face ID / Touch ID als lokale Entsperrung nach erfolgreichem Login.
3. Passkeys als P1 nach TestFlight, sobald der native WebAuthn-Pfad mit Supabase
   oder einem eigenen Verify-Service bewiesen ist.

## Akzeptanzkriterien für Face ID / Touch ID

- [ ] Nutzer ist angemeldet.
- [ ] Profil zeigt Face ID / Touch ID nur, wenn Hardware und Enrollment vorhanden sind.
- [ ] Aktivierung verlangt einmal lokale Authentifizierung.
- [ ] App sperrt beim Hintergrundwechsel und beim kalten Start.
- [ ] Erfolgreiche Face ID / Touch ID entsperrt die bestehende Session.
- [ ] Abbrechen lässt die App gesperrt.
- [ ] Abmelden entfernt die Supabase-Session aus SecureStore und AsyncStorage.
- [ ] Kein Passwort wird lokal gespeichert.

## Akzeptanzkriterien für echte Passkeys

- [ ] Registrierung erzeugt einen serverseitig gespeicherten Public Key.
- [ ] Login erzeugt eine serverseitige Challenge.
- [ ] Native App signiert die Challenge mit dem Passkey.
- [ ] Server prüft Signatur, Challenge, Origin/RP-ID und Replay-Schutz.
- [ ] Gekoppeltes Konto ist dasselbe wie bei E-Mail, Apple und Google.
- [ ] Account Recovery bleibt über E-Mail/Support klar geregelt.
- [ ] Review Notes erklären Passkeys und Fallback-Login.

## Quellen

- Supabase Auth Docs:
  `https://supabase.com/docs/guides/auth`
- Supabase React Native Auth:
  `https://supabase.com/docs/guides/auth/quickstarts/react-native`
- Apple AuthenticationServices:
  `https://developer.apple.com/documentation/authenticationservices`
- Apple Passkeys:
  `https://developer.apple.com/passkeys/`
