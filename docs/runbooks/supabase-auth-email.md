# Supabase Auth E-Mail-Templates

## Ziel

Supabase verschickt Auth-Mails nicht mit App-Branding, solange im Hosted-Projekt die Default-Templates aktiv sind. Für `clearn` sollen mindestens diese Flows gebrandet sein:

- Konto bestätigen
- Passwort zurücksetzen

## Templates im Repo

- `apps/api/supabase/templates/confirmation.html`
- `apps/api/supabase/templates/recovery.html`

Die lokale Supabase-Konfiguration referenziert diese Templates in `apps/api/supabase/config.toml`.

## Hosted Supabase aktualisieren

Hosted Supabase liest die lokalen Template-Dateien nicht automatisch. Für Production/Preview müssen die Inhalte ins Dashboard kopiert werden:

1. Supabase Dashboard öffnen.
2. Projekt `yektpwhycxusblnueplm` wählen.
3. `Authentication` -> `Email Templates` öffnen.
4. `Confirm signup` aktualisieren:
   - Subject: `E-Mail bestätigen - clearn`
   - Body: Inhalt aus `apps/api/supabase/templates/confirmation.html`
5. `Reset password` aktualisieren:
   - Subject: `Passwort zurücksetzen - clearn`
   - Body: Inhalt aus `apps/api/supabase/templates/recovery.html`
6. Testmail auslösen:
   - Neue Registrierung mit frischer Adresse.
   - Passwort-Reset mit bestehender Adresse.
7. Prüfen:
   - Absender ist nicht mehr generisch, sobald Custom SMTP aktiv ist.
   - Button-Link öffnet die App bzw. den erlaubten Redirect.
   - Fallback-Link ist sichtbar und klickbar.

## SMTP

Der aktuelle Absender `noreply@mail.app.supabase.io` ist Supabase-Default. Für Beta/Production Custom SMTP aktivieren, z. B. Resend:

- Sender Domain: `clearn`-Domain oder Subdomain mit SPF/DKIM/DMARC.
- From-Adresse: z. B. `clearn <noreply@...>`.
- Reply-To/Support: Support-Seite verlinken, nicht auf `noreply` antworten lassen.
- Tracking für Auth-Links deaktivieren, damit Supabase-Links nicht umgeschrieben werden.

## Variablen

Die Templates verwenden Supabase-Go-Template-Variablen:

- `{{ .ConfirmationURL }}` für Bestätigung und Passwort-Reset.
- `{{ .Email }}` für die betroffene Konto-Adresse.

Diese Variablen nicht escapen, umbenennen oder durch Platzhalter ersetzen.
