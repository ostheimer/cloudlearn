-- Aufräumen nach #342: Die Push-Bremse ist vollständig auf die eigene Tabelle
-- friend_push_log umgezogen (Migration 20260728120000), und der neue Code ist
-- live. Die alten Stempel-Spalten last_reminded_at_low / last_reminded_at_high
-- auf friend_streaks werden von keinem Code mehr gelesen oder geschrieben und
-- enthalten nur noch bedeutungslose Alt-Zeitstempel. Sie können entfernt werden.
--
-- Reihenfolge (umgekehrt zum Anlegen): erst wenn der Bremsen-Code nirgends mehr
-- läuft, dürfen die Spalten weg — das ist jetzt der Fall. Kein Index/View hängt
-- an ihnen. Nichts anderes in friend_streaks ist betroffen.
alter table friend_streaks
  drop column if exists last_reminded_at_low,
  drop column if exists last_reminded_at_high;
