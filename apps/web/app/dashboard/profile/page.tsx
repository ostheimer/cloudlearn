"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import {
  getLpBalance,
  getReferralInfo,
  getLeaderboard,
  getProfile,
  updateDisplayName,
  updateGender,
  displayNameErrorMessage,
  deleteAccount,
  isApiError,
  listPushDevices,
  type Gender,
  type PushDevice,
  type LeaderboardResponse,
  type ReferralInfoResponse,
} from "@/lib/api";
import { getStoredTheme, applyTheme, type ThemeChoice } from "@/lib/theme";
import { onboardingReplayHref } from "@/lib/onboarding";
import {
  User,
  Trash,
  Smartphone,
  Users,
  UserPlus,
  Copy,
  Check,
  Trophy,
  Flame,
  Zap,
  LogOut,
  ChevronRight,
  ShieldCheck,
  FileText,
  HelpCircle,
  AlertTriangle,
  BookOpen,
} from "@/components/icons";

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", lifetime: "Lifetime" };
const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];
// Gleiche vier Optionen wie die Registrierung (#609); „Sag ich nicht" bekommt
// wegen der längeren Beschriftung eine eigene Zeile.
const GENDER_OPTIONS: { value: Gender; label: string; wide?: boolean }[] = [
  { value: "female", label: "Weiblich" },
  { value: "male", label: "Männlich" },
  { value: "diverse", label: "Divers" },
  { value: "prefer_not_to_say", label: "Sag ich nicht", wide: true },
];

/** „iOS" / „Android" statt des rohen Plattform-Werts aus der Datenbank. */
function platformLabel(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ios") return "iPhone oder iPad";
  if (value === "android") return "Android-Gerät";
  if (value === "web") return "Browser";
  return "Unbekanntes Gerät";
}

/** „7. Juli 2026" — ohne Uhrzeit, die sagt hier nichts. */
function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const { email, signOut, resetPassword, changeEmail } = useAuth();
  const router = useRouter();

  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [tier, setTier] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralInfoResponse | null>(null);
  const [referralErr, setReferralErr] = useState(false);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [boardErr, setBoardErr] = useState(false);

  const [copied, setCopied] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  // E-Mail-Adresse ändern (#614)
  const [mailEditing, setMailEditing] = useState(false);
  const [mailDraft, setMailDraft] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailErr, setMailErr] = useState<string | null>(null);
  const [mailNotice, setMailNotice] = useState<string | null>(null);
  // Geräte mit registrierten Benachrichtigungen (#614, nur Anzeige)
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  // Zweistufig wie in der App (#571): 0 = zu, 1 = erste Nachfrage samt
  // Abo-Warnung, 2 = letzte Nachfrage. Ein einziger Klick hat hier alles
  // gelöscht — und niemand erfuhr, dass ein laufendes Abo davon nicht endet
  // und weiter abgebucht wird.
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  const [gender, setGender] = useState<Gender | null>(null);
  const [genderBusy, setGenderBusy] = useState(false);
  const [genderErr, setGenderErr] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    getLpBalance().then((u) => setTier(u.tier)).catch(() => {});
    getReferralInfo().then(setReferral).catch(() => setReferralErr(true));
    getLeaderboard().then(setBoard).catch(() => setBoardErr(true));
    getProfile()
      .then((p) => {
        setDisplayName(p.displayName);
        setGender(p.gender ?? null);
      })
      .catch(() => {});
  }, []);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setNameErr(null);
    setNameBusy(true);
    try {
      const res = await updateDisplayName(nameDraft);
      setDisplayName(res.displayName);
      setNameEditing(false);
    } catch (err) {
      setNameErr(displayNameErrorMessage(err));
    } finally {
      setNameBusy(false);
    }
  }

  function chooseTheme(choice: ThemeChoice) {
    applyTheme(choice);
    setTheme(choice);
  }

  async function chooseGender(value: Gender) {
    if (genderBusy || value === gender) return;
    setGenderErr(null);
    setGenderBusy(true);
    const previous = gender;
    setGender(value);
    try {
      await updateGender(value);
    } catch {
      setGender(previous);
      setGenderErr("Konnte nicht gespeichert werden — versuch es noch einmal.");
    } finally {
      setGenderBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handlePassword() {
    if (!email) return;
    setPwErr(null);
    const { error } = await resetPassword(email);
    if (error) {
      setPwErr(error);
      return;
    }
    setPwSent(true);
  }

  /**
   * Die Adresse ändert sich NICHT sofort — Supabase schickt erst eine
   * Bestätigung an die neue Adresse. Genau das sagt der Hinweis danach,
   * sonst wundert man sich, warum die Anmeldung noch die alte verlangt.
   */
  // Geräte einmal beim Öffnen holen. Scheitert es, bleibt `devices` auf
  // `null` und der Abschnitt sagt das, statt eine leere Liste zu zeigen —
  // „keine Geräte" wäre eine andere Aussage als „konnte nicht laden".
  useEffect(() => {
    let active = true;
    void listPushDevices()
      .then(({ devices: fetched }) => {
        if (active) setDevices(fetched);
      })
      .catch(() => {
        if (active) setDevices(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleMailSave(e: React.FormEvent) {
    e.preventDefault();
    const next = mailDraft.trim();
    if (!next) return;
    setMailBusy(true);
    setMailErr(null);
    const { error } = await changeEmail(next);
    setMailBusy(false);
    if (error) {
      setMailErr(error);
      return;
    }
    setMailEditing(false);
    setMailNotice(
      `Bestätigung an ${next} geschickt. Deine Adresse ändert sich erst, wenn du den Link darin anklickst.`
    );
  }

  async function copyCode() {
    if (!referral?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referral.referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is visible to copy by hand */
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await signOut();
      router.replace("/login");
    } catch (e) {
      setDeleteError(isApiError(e) ? e.message : "Konto konnte nicht gelöscht werden.");
      setDeleting(false);
    }
  }

  const shownEntries = board?.entries.slice(0, 5) ?? [];
  const meShown = shownEntries.some((e) => e.isCurrentUser);

  return (
    <>
      <div className="lib-head">
        <div>
          <h1>Profil &amp; Einstellungen</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Dein Konto, Aussehen, Freunde und die Rangliste.
          </p>
        </div>
      </div>

      <div className="settings">
        {/* Profil-Kopf */}
        <div className="pf-banner">
          <span className="pf-banner__ava" aria-hidden>
            <User size={26} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="pf-banner__mail">{email ?? "—"}</div>
            <div className="pf-banner__sub">Angemeldet</div>
          </div>
        </div>

        {/* Konto: Anzeigename, Tarif, Design, Passwort */}
        <div className="pf-card">
          <div className="pf-row">
            <div className="pf-row__t">
              <b>Anzeigename</b>
              <span style={nameErr ? { color: "#dc2626" } : undefined}>
                {nameErr ?? "So sehen dich andere in Rangliste und Freundesliste"}
              </span>
            </div>
            {nameEditing ? (
              <form onSubmit={handleNameSave} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={20}
                  autoFocus
                  disabled={nameBusy}
                  aria-label="Anzeigename"
                  style={{ width: 180 }}
                />
                <button type="submit" className="btn btn-primary" disabled={nameBusy || !nameDraft.trim()}>
                  {nameBusy ? "…" : "Speichern"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setNameEditing(false);
                    setNameErr(null);
                  }}
                  disabled={nameBusy}
                >
                  Abbrechen
                </button>
              </form>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <b>{displayName ?? "—"}</b>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setNameDraft(displayName ?? "");
                    setNameErr(null);
                    setNameEditing(true);
                  }}
                >
                  Ändern
                </button>
              </div>
            )}
          </div>

          <div className="pf-row">
            <div className="pf-row__t">
              <b>Geschlecht</b>
              <span style={genderErr ? { color: "#dc2626" } : undefined}>
                {genderErr ?? "So nennt dich clearn bei deinen Freunden"}
              </span>
            </div>
            <div className="seg seg--wrap" role="group" aria-label="Geschlecht">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`seg__btn${opt.wide ? " seg__btn--row" : ""}${
                    gender === opt.value ? " is-on" : ""
                  }`}
                  aria-pressed={gender === opt.value}
                  onClick={() => chooseGender(opt.value)}
                  disabled={genderBusy}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pf-row">
            <div className="pf-row__t">
              <b>Dein Tarif</b>
              {/* Wer Pro schon hat, soll nicht zum "Freischalten" aufgefordert
                  werden (#607, Laras Variante A). */}
              <span>
                {tier === "pro" || tier === "lifetime"
                  ? "Pro ist auf deinem Konto aktiv — verwalten kannst du es in der clearn-App"
                  : "Pro gibt es in der clearn-App"}
              </span>
            </div>
            <span className={`tier-badge tier-badge--${tier ?? "free"}`}>
              {tier ? (TIER_LABEL[tier] ?? tier) : "…"}
            </span>
          </div>

          <div className="pf-row">
            <div className="pf-row__t">
              <b>Design</b>
              <span>Hell, Dunkel oder System</span>
            </div>
            <div className="seg" role="group" aria-label="Design">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`seg__btn${theme === opt.value ? " is-on" : ""}`}
                  aria-pressed={theme === opt.value}
                  onClick={() => chooseTheme(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* #609: Die Einführung war nach dem ersten Besuch nicht mehr
              erreichbar. „erneut=1" sorgt dafür, dass dabei kein zweites
              Beispiel-Deck entsteht. */}
          <div className="pf-row">
            <div className="pf-row__t">
              <b>Einführung</b>
              <span>Die fünf Schritte vom ersten Start</span>
            </div>
            <Link href={onboardingReplayHref} className="btn btn-ghost">
              Erneut ansehen
            </Link>
          </div>

          <div className="pf-row">
            <div className="pf-row__t">
              <b>Passwort</b>
              <span style={pwErr ? { color: "#dc2626" } : undefined}>
                {pwErr ?? "Setzt dein Passwort per E-Mail zurück"}
              </span>
            </div>
            <button type="button" className="btn btn-ghost" onClick={handlePassword}>
              {pwSent ? "E-Mail gesendet" : "Ändern"}
            </button>
          </div>

          {/* E-Mail-Adresse ändern (#614). Bis hierher klebte das Konto an der
              Adresse, mit der es angelegt wurde — ein abgeschaltetes
              Schul-Postfach hätte es unerreichbar gemacht. */}
          <div className="pf-row">
            <div className="pf-row__t">
              <b>E-Mail-Adresse</b>
              <span style={mailErr ? { color: "#dc2626" } : undefined}>
                {mailErr ?? mailNotice ?? email ?? "—"}
              </span>
            </div>
            {mailEditing ? (
              <form
                onSubmit={handleMailSave}
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
              >
                <input
                  className="input"
                  type="email"
                  value={mailDraft}
                  onChange={(e) => setMailDraft(e.target.value)}
                  autoFocus
                  disabled={mailBusy}
                  aria-label="Neue E-Mail-Adresse"
                  placeholder="neue@adresse.de"
                  style={{ width: 200 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={mailBusy || !mailDraft.trim()}
                >
                  {mailBusy ? "…" : "Senden"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setMailEditing(false);
                    setMailErr(null);
                  }}
                  disabled={mailBusy}
                >
                  Abbrechen
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMailDraft("");
                  setMailErr(null);
                  setMailNotice(null);
                  setMailEditing(true);
                }}
              >
                Ändern
              </button>
            )}
          </div>
        </div>

        {/* Community: Freunde + Rangliste */}
        <div className="pf-grid2">
          <div className="pf-card pf-card--pad">
            <div className="pf-card__head">
              <span className="pf-ic pf-ic--green" aria-hidden>
                <Users size={18} />
              </span>
              Freunde einladen
            </div>
            {referral?.referralCode ? (
              <>
                <div className="ref-code-row">
                  <code className="ref-code">{referral.referralCode}</code>
                  <button type="button" className="btn btn-ghost" onClick={copyCode}>
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Kopiert" : "Kopieren"}
                  </button>
                </div>
                <p className="pf-card__sub" style={{ margin: "12px 0 0" }}>
                  Löst dein Freund oder deine Freundin deinen Code ein, bekommt ihr sofort
                  Lernpunkte: du 50, dein Freund oder deine Freundin 25.
                  {referral.referredCount > 0 &&
                    ` Bisher geworben: ${referral.referredCount} · verdient: ${referral.lpEarnedFromReferrals} LP.`}
                </p>
              </>
            ) : referralErr ? (
              <p className="muted">Der Einladungs-Code konnte nicht geladen werden.</p>
            ) : referral ? (
              <p className="muted">Noch kein Einladungs-Code vorhanden.</p>
            ) : (
              <p className="muted">Dein Einladungs-Code wird geladen …</p>
            )}
            <Link
              href="/dashboard/friends/add"
              className="btn btn-primary btn-block"
              style={{ marginTop: 14, gap: 8, textDecoration: "none" }}
            >
              <UserPlus size={16} /> Freund oder Freundin hinzufügen
            </Link>
          </div>

          <Link href="/dashboard/leaderboard" className="pf-card pf-card--pad pf-card--link">
            <div className="pf-card__head">
              <span className="pf-ic pf-ic--amber" aria-hidden>
                <Trophy size={18} />
              </span>
              Rangliste
            </div>
            {board ? (
              <div className="lb">
                {shownEntries.map((e) => (
                  <div key={e.rank} className={`lb-row${e.isCurrentUser ? " lb-row--me" : ""}`}>
                    <span className="lb-row__rank">{e.rank}</span>
                    <span className="lb-row__name">{e.isCurrentUser ? "Du" : e.displayName}</span>
                    {e.currentStreak > 0 && (
                      <span className="lb-row__streak">
                        <Flame size={13} /> {e.currentStreak}
                      </span>
                    )}
                    <span className="lb-row__lp">
                      <Zap size={13} /> {e.lpBalance.toLocaleString("de-DE")}
                    </span>
                  </div>
                ))}
                {!meShown && board.myRank > 0 && (
                  <div className="lb-row lb-row--me">
                    <span className="lb-row__rank">{board.myRank}</span>
                    <span className="lb-row__name">Du</span>
                    <span className="lb-row__lp" />
                  </div>
                )}
              </div>
            ) : boardErr ? (
              <p className="muted">Die Rangliste konnte nicht geladen werden.</p>
            ) : (
              <p className="muted">Rangliste wird geladen …</p>
            )}
            <span className="pf-card__more">
              Ganze Rangliste anzeigen <ChevronRight size={16} />
            </span>
          </Link>
        </div>

        {/* Deine Daten — Einstieg in den Papierkorb (#614) */}
        <div className="pf-card">
          <div className="pf-card__label">Deine Daten</div>
          <Link className="pf-navrow" href="/dashboard/trash">
            <span className="pf-ic pf-ic--indigo" aria-hidden>
              <Trash size={18} />
            </span>
            <div className="pf-navrow__t">
              <b>Papierkorb</b>
              <span>Gelöschte Decks und Karten zurückholen</span>
            </div>
            <ChevronRight size={18} />
          </Link>

          {/* Geräte-Übersicht (#614), NUR Anzeige — Laras Abgrenzung.
              Überschrift und Nachsatz nennen die Grenze ausdrücklich: Die Liste
              kommt aus den Push-Registrierungen, und die gibt es nur in der App.
              Ein Browser steht hier nie — „Deine Geräte" wäre schlicht falsch. */}
          <div className="pf-row" style={{ alignItems: "flex-start" }}>
            <div className="pf-row__t">
              <b>Geräte mit der clearn-App</b>
              {/* Erst sagen, was drinsteht, dann was fehlt (Vorschlag der
                  #571-Sitzung). */}
              <span>
                Nur Geräte, auf denen die App installiert ist und Benachrichtigungen erlaubt
                sind. Ein Browser erscheint hier nie.
              </span>
            </div>
          </div>
          {devices === null ? (
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              Geräte konnten nicht geladen werden.
            </p>
          ) : devices.length === 0 ? (
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              Noch kein Gerät hat Benachrichtigungen erlaubt.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "grid", gap: 6 }}>
              {devices.map((device, index) => (
                <li
                  key={`${device.platform}-${device.lastSeenAt}-${index}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                >
                  <span style={{ flex: "none", display: "inline-flex" }} aria-hidden>
                    <Smartphone size={16} />
                  </span>
                  {/* „zuletzt aktiv" bewusst NICHT kleingedruckt: Ein Token
                      verschwindet nicht, wenn jemand die App löscht oder das
                      Handy weggibt — das Gerät stünde sonst mit einem winzigen
                      Datum da und erschreckt mehr, als es hilft. */}
                  <span style={{ flex: 1, minWidth: 0, fontSize: "0.9rem" }}>
                    <span style={{ display: "block" }}>{platformLabel(device.platform)}</span>
                    <span style={{ display: "block" }}>
                      zuletzt aktiv am {formatDay(device.lastSeenAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hilfe & Rechtliches */}
        <div className="pf-card">
          <div className="pf-card__label">Hilfe &amp; Rechtliches</div>
          <a className="pf-navrow" href="/support">
            <span className="pf-ic pf-ic--indigo" aria-hidden>
              <HelpCircle size={18} />
            </span>
            <div className="pf-navrow__t">
              <b>Support</b>
              <span>Fragen zu Konto, Käufen oder Import</span>
            </div>
            <ChevronRight size={18} />
          </a>
          <a className="pf-navrow" href="/privacy">
            <span className="pf-ic pf-ic--green" aria-hidden>
              <ShieldCheck size={18} />
            </span>
            <div className="pf-navrow__t">
              <b>Datenschutz</b>
              <span>So verarbeitet clearn deine Daten</span>
            </div>
            <ChevronRight size={18} />
          </a>
          <a className="pf-navrow" href="/impressum">
            <span className="pf-ic pf-ic--amber" aria-hidden>
              <FileText size={18} />
            </span>
            <div className="pf-navrow__t">
              <b>Impressum</b>
              <span>Kontakt und Anbieterangaben</span>
            </div>
            <ChevronRight size={18} />
          </a>
          <a className="pf-navrow" href="/terms">
            <span className="pf-ic pf-ic--indigo" aria-hidden>
              <BookOpen size={18} />
            </span>
            <div className="pf-navrow__t">
              <b>Nutzungsbedingungen</b>
              <span>Regeln für Konto, Käufe und Kündigung</span>
            </div>
            <ChevronRight size={18} />
          </a>
        </div>

        {/* Konto löschen + Abmelden */}
        <div className="pf-bottom">
          {deleteStep === 0 ? (
            <button type="button" className="pf-danger" onClick={() => setDeleteStep(1)}>
              <span className="pf-ic pf-ic--danger" aria-hidden>
                <Trash size={18} />
              </span>
              <div className="pf-danger__t">
                <b>Konto löschen</b>
                <span>Löscht Konto, Decks, Karten und Lernfortschritt endgültig</span>
              </div>
            </button>
          ) : (
            // Wortlaute aus der App (resources.ts, profile.deleteAccount*) —
            // dort ist der Ablauf seit jeher zweistufig und nennt das Abo.
            <div className="danger-confirm">
              <div className="danger-confirm__head">
                <AlertTriangle size={18} />{" "}
                {deleteStep === 1 ? "Konto endgültig löschen?" : "Wirklich jetzt löschen?"}
              </div>
              {deleteStep === 1 ? (
                <>
                  <p className="muted">
                    Dein Konto, alle Decks, Karten, Lernstände und Synchronisierungsdaten werden
                    sofort dauerhaft gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.
                  </p>
                  {/* Der Kauf läuft über Apple bzw. Google, nicht über uns — die
                      Kontolöschung beendet ihn also nicht. Ohne diesen Satz wird
                      nach dem Löschen weiter abgebucht. */}
                  <p className="muted">
                    Wichtiger Hinweis: Ein aktives Apple- oder Google-Abo wird dadurch nicht
                    automatisch beendet und muss separat im jeweiligen Store verwaltet werden.
                  </p>
                </>
              ) : (
                <p className="muted">
                  Wenn du fortfährst, wird dein clearn-Konto sofort und endgültig entfernt.
                </p>
              )}
              {deleteError && <p className="form-error">{deleteError}</p>}
              <div className="danger-confirm__actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={deleteStep === 1 ? () => setDeleteStep(2) : handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Wird gelöscht…" : deleteStep === 1 ? "Weiter" : "Endgültig löschen"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setDeleteStep(0);
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          <button type="button" className="pf-signout" onClick={handleSignOut}>
            <LogOut size={18} /> Abmelden
          </button>
        </div>
      </div>
    </>
  );
}
