-- #607: Zahlungsprobleme sichtbar machen. RevenueCat meldet BILLING_ISSUE
-- (z. B. abgelaufene Kreditkarte), der Nutzer bekam davon bisher nie etwas
-- zu sehen. NULL = kein bekanntes Zahlungsproblem. Gesetzt vom Abo-Webhook
-- beim Ereignis BILLING_ISSUE, geloescht bei jedem anderen Abo-Ereignis
-- desselben Kontos (RENEWAL = Zahlung wieder ok, EXPIRATION = eh free).
alter table public.profiles
  add column if not exists billing_issue_at timestamptz;
