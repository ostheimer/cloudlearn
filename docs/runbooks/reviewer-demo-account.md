# Reviewer Demo Account

Stand: 2026-05-03

## Ziel

Dieses Runbook definiert, wie ein App-Review-/TestFlight-Demo-Konto vorbereitet wird, ohne echte Privatkonten oder frei erfundene Credentials in Git zu speichern.

## Konto-Konvention

- E-Mail-Muster: `reviewer+<YYYYMMDD>@ostheimer.at`
- Passwort: nur im Passwortmanager speichern, nie im Repository
- Zweck: App Store Review, Play Review und interne TestFlight-Smokes

## Vorbereitung

1. Demo-Konto über die App registrieren.
2. E-Mail bestätigen.
3. Ein kleines Beispiel-Deck anlegen:
   - Deck: `Biologie Grundlagen`
   - Karten: 8-12 einfache Karten
   - mindestens eine Review-Session durchführen
4. Optional ein zweites Deck anlegen:
   - Deck: `Geschichte Überblick`
   - Karten: 5-8 Karten
5. Face ID im Profil deaktiviert lassen, damit Reviewer nicht blockiert werden.
6. Tracking auf nicht-personalisierte Werbung stellen, sofern der Review kein ATT-Opt-in testen soll.
7. Keine echten personenbezogenen Lerninhalte verwenden.

## Review Notes ausfüllen

In [docs/runbooks/app-store-review-notes.md](/docs/runbooks/app-store-review-notes.md) vor Submission ersetzen:

- `<REVIEW_EMAIL>` durch die echte Demo-E-Mail
- `<REVIEW_PASSWORD>` durch das Passwort aus dem Passwortmanager
- Build-Nummer ergänzen
- bekannte Einschränkungen ergänzen

## Nach jedem größeren Release prüfen

- Login mit Demo-Konto funktioniert.
- Home zeigt vorhandene Decks und fällige Karten.
- `Scan` kann geöffnet werden.
- `Lernen` kann eine Session starten.
- Paywall und Restore sind erreichbar.
- Profil zeigt Support, Datenschutz, Tracking und Konto-Löschung.

## Rückbau

Nach Review-Ende:

- Wenn das Konto nicht mehr gebraucht wird, über Profil → Konto löschen entfernen.
- Danach in Supabase prüfen, dass `deleted_accounts` eine Tombstone-Zeile enthält.
- Neues Konto erst für den nächsten Review-Zyklus anlegen.
