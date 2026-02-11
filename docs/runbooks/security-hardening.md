# Security Hardening Checklist

## API

- Alle mutierenden Endpunkte prüfen Input per Zod-Schema.
- Idempotency-Key auf kritischen Endpunkten erzwingen.
- Rate-Limits pro Nutzer und Tarif aktiv halten.
- `request_id` in Fehlerantworten und Logs mitschreiben.

## Storage

- Upload nur über kurzlebige Signed URLs.
- Dateinamen sanitizen (keine Pfad-Traversal-Zeichen).
- Öffentliche Buckets als Default vermeiden.

## Secrets

- Keine Secrets im Mobile Bundle.
- `.env` nicht committen.
- Rotationsprozess für API Keys dokumentieren.

## Betrieb

- Alert bei ungewöhnlichen Fehler- oder Traffic-Spitzen.
- Postmortem-Pflicht für Security-relevante Vorfälle.
