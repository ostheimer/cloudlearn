# TestFlight Smoke Checklist

Stand: 2026-05-02

## Ziel

Diese Checkliste definiert den manuellen Smoke-Test für den ersten echten TestFlight-Build.
Sie soll vor jeder externen Beta-Freigabe einmal vollständig auf einem physischen iPhone durchlaufen werden.

## Testdaten

- Build: `<BUILD_NUMBER>`
- Gerät: `<DEVICE_MODEL>`
- iOS-Version: `<IOS_VERSION>`
- Testkonto: `<TEST_EMAIL>`
- Datum: `<DATE>`

## 1. Fresh Install

- [ ] App aus TestFlight installieren.
- [ ] App starten.
- [ ] Splashscreen erscheint und verschwindet ohne Hänger.
- [ ] App landet auf Login oder Gast-Start, ohne Crash.
- [ ] Kein roter React-Native-Fehlerbildschirm.

## 2. Gastmodus

- [ ] `Erst einmal ohne Login starten` funktioniert.
- [ ] Home ist sichtbar.
- [ ] Bottom-Navigation ist auf Home, Scan, Lernen, Bibliothek und Profil sichtbar.
- [ ] Scan/Lernen/Bibliothek zeigen für geschützte Aktionen eine klare Login-Aufforderung.
- [ ] Zurücknavigation führt nicht in eine leere Ansicht.

## 3. E-Mail-Login

- [ ] Registrierung mit Test-E-Mail funktioniert.
- [ ] Bestätigungs-E-Mail kommt an.
- [ ] E-Mail-Link öffnet die App.
- [ ] App ist danach angemeldet und zeigt die korrekte E-Mail im Profil.
- [ ] Logout funktioniert.
- [ ] Login mit E-Mail/Passwort funktioniert erneut.

## 4. Passwort Zurücksetzen

- [ ] `Passwort vergessen?` sendet eine Recovery-E-Mail.
- [ ] Recovery-Link öffnet den Screen `Neues Passwort setzen`.
- [ ] Neues Passwort speichern funktioniert.
- [ ] Danach landet der Nutzer beim Login oder in einem klaren angemeldeten Zustand.
- [ ] Login mit dem neuen Passwort funktioniert.
- [ ] Ein abgelaufener Link zeigt eine verständliche Fehlermeldung.

## 5. OAuth

- [ ] Google Sign-In Happy Path funktioniert.
- [ ] Google Cancel erzeugt keinen kaputten Session-State.
- [ ] Apple Sign-In Happy Path funktioniert.
- [ ] Apple Cancel erzeugt keinen kaputten Session-State.
- [ ] Logout und erneuter Login funktionieren.

## 6. Kernflow

- [ ] Text-Scan erzeugt Karten.
- [ ] Deck erscheint in der Bibliothek.
- [ ] Lernen startet eine Review-Session.
- [ ] Eine Karte kann bewertet werden.
- [ ] Tagesziel/Streak aktualisiert sich plausibel.

## 7. Face ID

- [ ] Face ID im Profil aktivieren.
- [ ] App in den Hintergrund schicken und wieder öffnen.
- [ ] Face-ID-Sperre erscheint.
- [ ] Erfolgreiche Face ID entsperrt die App.
- [ ] Abbrechen bleibt gesperrt oder führt in einen sicheren Zustand.
- [ ] Face ID deaktivieren funktioniert.

## 8. Tracking / Rewarded Ads

- [ ] Tracking-Einstellungen im Profil öffnen.
- [ ] Nicht-personalisierte Werbung auswählen.
- [ ] Rewarded-Ad-Flow bleibt verfügbar.
- [ ] Personalisierte Werbung triggert zuerst den In-App-Pre-Prompt.
- [ ] Native ATT-Abfrage erscheint nur im passenden Kontext.
- [ ] Ablehnung führt zu nicht-personalisiertem Fallback.

## 9. Paywall / Käufe

- [ ] Paywall lädt ohne Absturz.
- [ ] Produkte erscheinen mit Store-Preisen.
- [ ] Restore-Button ist sichtbar und bedienbar.
- [ ] Kauf-Cancel erzeugt keine falsche Pro-Aktivierung.
- [ ] Store-Abo-Verwaltung im Profil öffnet die Store-Einstellungen.

## 10. Konto-Löschung

- [ ] Profil → Konto löschen ist sichtbar.
- [ ] Warnung zur endgültigen Datenlöschung ist klar.
- [ ] Hinweis zur separaten Store-Abo-Verwaltung ist sichtbar.
- [ ] Löschung meldet Erfolg.
- [ ] Nutzer wird abgemeldet.
- [ ] Login mit dem gelöschten Konto ist nicht mehr möglich.

## Ergebnis

- [ ] Bestanden
- [ ] Blockiert

Notizen:

```text
<NOTES>
```
