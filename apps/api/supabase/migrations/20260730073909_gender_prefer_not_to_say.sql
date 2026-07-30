-- Vierte Geschlechts-Option „Sag ich nicht" (Issue #609, Laras Entscheidung
-- 30.07.): Niemand soll bei der Registrierung etwas Persönliches angeben
-- MÜSSEN. Eigener Wert statt NULL, damit unterscheidbar bleibt, ob jemand
-- bewusst nichts sagen wollte oder ob das Konto von vor der Abfrage stammt.
-- Für alle Texte verhält sich der Wert wie 'diverse': neutrale Formulierung.
--
-- Der CHECK muss dafür ersetzt werden — Postgres kann eine bestehende
-- Bedingung nicht erweitern. Name aus 20260723150000: dort ohne expliziten
-- Namen angelegt, Postgres vergibt <tabelle>_<spalte>_check.
alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('female', 'male', 'diverse', 'prefer_not_to_say'));

-- Schreibrecht bleibt wie gehabt beim geprüften API-Endpunkt (service_role);
-- der Revoke aus 20260723150000 gilt unverändert weiter.
