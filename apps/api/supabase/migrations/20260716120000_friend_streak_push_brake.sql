-- Push-Bremse für Freunde-Streaks: höchstens EIN Push pro Absender → Empfänger
-- und lokalem Tag (Europe/Berlin, #211). Ohne Bremse feuert jeder Aufruf von
-- `remindFriendStreak` (und jede frische Einladung) sofort einen Push mit frei
-- wählbarem Anzeigenamen — beliebig oft.
--
-- `friend_streaks` hat eine Zeile pro ungeordnetem Paar (user_low < user_high),
-- deshalb braucht die Bremse einen Stempel je Richtung: wenn A B anstupst, darf
-- das B nicht den eigenen Stupser an A am selben Tag wegnehmen. Das spiegelt die
-- bestehende last_day_low / last_day_high-Konvention derselben Tabelle.
--
-- Beide Spalten sind NULLABLE und ohne Default: bereits ausgerollter Code, der
-- sie nicht kennt, schreibt weiter unverändert (diese Migration wird VOR dem
-- zugehörigen Code angewendet). NULL = in dieser Richtung noch nie gepusht.
alter table friend_streaks
  add column if not exists last_reminded_at_low  timestamptz,
  add column if not exists last_reminded_at_high timestamptz;

comment on column friend_streaks.last_reminded_at_low is
  'Letzter Push von user_low an user_high (Push-Bremse: max. 1 pro lokalem Tag). NULL = noch nie.';
comment on column friend_streaks.last_reminded_at_high is
  'Letzter Push von user_high an user_low (Push-Bremse: max. 1 pro lokalem Tag). NULL = noch nie.';
