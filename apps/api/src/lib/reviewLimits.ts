/**
 * Gemeinsames Minuten-Kontingent für Wiederholungen — geteilt von
 * POST /api/v1/cards/[id]/review (Gewicht 1 je Aufruf) und
 * POST /api/v1/learn/sync (Gewicht = enthaltene Wiederholungen).
 *
 * Beide Wege legen dieselben review_logs-Zeilen an, und aus genau diesen
 * Zeilen entstehen Lernpunkte. Zwei getrennte Töpfe hätten bedeutet, dass der
 * Sync-Weg die Grenze des Einzelwegs aushebelt: 10 Pakete/min à 500
 * Operationen = 5000 Wiederholungen/min gegenüber 600 (#358).
 *
 * Warum 600 und nicht weniger: Ein Offline-Paket darf 500 Operationen tragen
 * (syncRequestSchema `.max(500)`). Läge die Grenze darunter, käme ein Stapel
 * Nachzügler NIE durch — er würde abgewiesen, zurück in die Warteschlange
 * wandern und 30 s später erneut abprallen. Eine Bremse, die ehrliches
 * Offline-Lernen in eine Endlosschleife schickt, ist schlimmer als das Loch,
 * das sie stopfen soll. 600 lässt ein volles Paket plus etwas Luft durch.
 *
 * Legitimes Lernen von Hand liegt weit darunter: schnelles Zuordnen erzeugt
 * vielleicht 60/min, eine 100-Fragen-Prüfung geht seit PR #378 in 25er-Häppchen
 * raus.
 */
export const REVIEW_RATE_LIMIT_PER_MINUTE = 600;
