"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import {
  getLpBalance,
  getReferralInfo,
  getLeaderboard,
  deleteAccount,
  isApiError,
  type LeaderboardResponse,
  type ReferralInfoResponse,
} from "@/lib/api";
import { getStoredTheme, applyTheme, type ThemeChoice } from "@/lib/theme";
import {
  User,
  Lock,
  Trash,
  Sparkles,
  Star,
  Users,
  Copy,
  Check,
  Trophy,
  Flame,
  Zap,
  LogOut,
  Globe,
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
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);

  const [copied, setCopied] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    getLpBalance()
      .then((u) => setTier(u.tier))
      .catch(() => {});
    getReferralInfo()
      .then(setReferral)
      .catch(() => {});
    getLeaderboard()
      .then(setBoard)
      .catch(() => {});
  }, []);

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
    await resetPassword(email);
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

  const shownEntries = board?.entries.slice(0, 8) ?? [];
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

      <div className="settings-grid">
        {/* Konto, Design, Tarif, Freunde in einem zweispaltigen Raster (Desktop);
            am Handy automatisch eine Spalte. */}
        <div className="settings-cols">
        {/* Konto */}
        <section className="panel settings-card">
          <div className="settings-card__head">
            <User size={18} /> Konto
          </div>
          <div className="settings-account">
            <span className="profile-avatar" aria-hidden>
              <User size={24} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Angemeldet als</div>
              <div className="muted" style={{ overflowWrap: "anywhere" }}>
                {email ?? "—"}
              </div>
            </div>
          </div>
          <div className="profile-actions">
            <button type="button" className="profile-row" onClick={handlePassword}>
              <Lock size={18} /> {pwSent ? "E-Mail zum Zurücksetzen gesendet" : "Passwort ändern"}
            </button>
            <button type="button" className="profile-row" onClick={handleSignOut}>
              <LogOut size={18} /> Abmelden
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                className="profile-row profile-row--danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash size={18} /> Konto löschen
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
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
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
          </div>
        </section>

        {/* Design */}
        <section className="panel settings-card">
          <div className="settings-card__head">
            <Sparkles size={18} /> Design
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
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            „System" folgt deinem Gerät.
          </p>
        </section>

        {/* Dein Tarif */}
        <section className="panel settings-card">
          <div className="settings-card__head">
            <Star size={18} /> Dein Tarif
          </div>
          <div className="tier-row">
            <span className={`tier-badge tier-badge--${tier ?? "free"}`}>
              {tier ? (TIER_LABEL[tier] ?? tier) : "…"}
            </span>
            {tier === "free" && (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Pro-Vorteile schaltest du in der clearn-App frei.
              </span>
            )}
          </div>
        </section>

        {/* Freunde einladen */}
        <section className="panel settings-card">
          <div className="settings-card__head">
            <Users size={18} /> Freunde einladen
          </div>
          {referral?.referralCode ? (
            <>
              <div className="ref-code-row">
                <code className="ref-code">{referral.referralCode}</code>
                <button type="button" className="btn btn-ghost" onClick={copyCode}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Kopiert" : "Kopieren"}
                </button>
              </div>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                +50 Lernpunkte, wenn deine Freundin 7 Tage lernt.
                {referral.referredCount > 0 &&
                  ` Bisher geworben: ${referral.referredCount} · verdient: ${referral.lpEarnedFromReferrals} LP.`}
              </p>
            </>
          ) : (
            <p className="muted">Dein Einladungs-Code wird geladen …</p>
          )}
        </section>
        </div>

        {/* Rangliste (volle Breite) */}
        <section className="panel settings-card">
          <div className="settings-card__head">
            <Trophy size={18} /> Rangliste
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
          ) : (
            <p className="muted">Rangliste wird geladen …</p>
          )}
        </section>

        <div className="settings-card">
          <a href="/" className="profile-row">
            <Globe size={18} /> Zur Website
          </a>
        </div>
      </div>
    </>
  );
}
