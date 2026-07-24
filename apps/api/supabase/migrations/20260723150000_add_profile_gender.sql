-- Geschlecht fürs Freunde-Wording (Issue #498 Punkt 2, Laras Entscheidung):
-- Pflichtfeld bei der Registrierung (Weiblich/Männlich/Divers). Gespeichert
-- als stabiles englisches Token; NULL bleibt für Bestandskonten erlaubt und
-- bedeutet: neutrale Formulierung („… lernt jetzt mit dir").
alter table public.profiles
  add column if not exists gender text
  check (gender in ('female', 'male', 'diverse'));

-- Wie beim Anzeigenamen (20260722160000): geschrieben wird nur über den
-- geprüften API-Endpunkt (service_role). Die Spalte bekommt nie einen
-- PostgREST-Direktwrite — der Revoke hält das auch fest, falls ein späteres
-- Setup-Skript pauschal Spaltenrechte verteilt.
revoke update (gender) on public.profiles from anon, authenticated;
