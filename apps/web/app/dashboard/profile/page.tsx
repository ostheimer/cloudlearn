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
  displayNameErrorMessage,
  deleteAccount,
  isApiError,
  type LeaderboardResponse,
  type ReferralInfoResponse,
} from "@/lib/api";
import { getStoredTheme, applyTheme, type ThemeChoice } from "@/lib/theme";
import {
  User,
  Trash,
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
} from "@/components/icons";

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", lifetime: "Lifetime" };
const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];

export default function ProfilePage() {
  const { email, signOut, resetPassword } = useAuth();
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    getLpBalance().then((u) => setTier(u.tier)).catch(() => {});
    getReferralInfo().then(setReferral).catch(() => setReferralErr(true));
    getLeaderboard().then(setBoard).catch(() => setBoardErr(true));
    getProfile().then((p) => setDisplayName(p.displayName)).catch(() => {});
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
              <b>Dein Tarif</b>
              <span>Pro-Vorteile schaltest du in der clearn-App frei</span>
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
                  +50 Lernpunkte, wenn dein Freund oder deine Freundin 7 Tage lernt.
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
        </div>

        {/* Konto löschen + Abmelden */}
        <div className="pf-bottom">
          {!confirmDelete ? (
            <button type="button" className="pf-danger" onClick={() => setConfirmDelete(true)}>
              <span className="pf-ic pf-ic--danger" aria-hidden>
                <Trash size={18} />
              </span>
              <div className="pf-danger__t">
                <b>Konto löschen</b>
                <span>Löscht Konto, Decks, Karten und Lernfortschritt endgültig</span>
              </div>
            </button>
          ) : (
            <div className="danger-confirm">
              <div className="danger-confirm__head">
                <AlertTriangle size={18} /> Konto wirklich löschen?
              </div>
              <p className="muted">
                Dein Konto und alle Decks werden dauerhaft gelöscht. Das kann nicht rückgängig
                gemacht werden.
              </p>
              {deleteError && <p className="form-error">{deleteError}</p>}
              <div className="danger-confirm__actions">
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Wird gelöscht…" : "Endgültig löschen"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setConfirmDelete(false);
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
