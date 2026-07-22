"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  getLeaderboard,
  getFriendsLeaderboard,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type FriendsLeaderboardResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  Crown,
  Flame,
  Globe,
  Medal,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "@/components/icons";

type Tab = "global" | "friends";

// Medaillenfarben wie im App-Bildschirm (apps/mobile/app/leaderboard.tsx).
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";
const PODIUM_COLORS = [SILVER, GOLD, BRONZE];
const PODIUM_HEIGHTS = [66, 88, 56];

function RankBadge({ entry }: { entry: LeaderboardEntry }) {
  if (entry.rank === 1) return <Trophy size={20} style={{ color: GOLD }} fill={GOLD} />;
  if (entry.rank === 2) return <Medal size={20} style={{ color: SILVER }} />;
  if (entry.rank === 3) return <Medal size={20} style={{ color: BRONZE }} />;
  return <span className="lbx-rank">{entry.rank}</span>;
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const cls = entry.isCurrentUser
    ? "lbx-row lbx-row--me"
    : entry.rank <= 3
      ? "lbx-row lbx-row--top"
      : "lbx-row";
  return (
    <div className={cls}>
      <span className="lbx-row__badge">
        <RankBadge entry={entry} />
      </span>
      <span className="lbx-ava" aria-hidden>
        {(entry.displayName?.[0] ?? "?").toUpperCase()}
      </span>
      <span className="lbx-row__name">
        {entry.displayName}
        {entry.isCurrentUser ? " (Du)" : ""}
        {entry.currentStreak > 0 && (
          <span className="lbx-row__streak">
            <Flame size={12} fill="currentColor" /> {entry.currentStreak}
          </span>
        )}
      </span>
      <span className="lbx-row__lp">
        <Zap size={14} /> {entry.lpBalance.toLocaleString("de-DE")}
      </span>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("global");
  const [global, setGlobal] = useState<LeaderboardResponse | null>(null);
  const [friends, setFriends] = useState<FriendsLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/profile");
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([getLeaderboard(), getFriendsLeaderboard()])
      .then(([g, f]) => {
        setGlobal(g);
        setFriends(f);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = (tab === "global" ? global?.entries : friends?.entries) ?? [];
  const friendCount = friends?.friendCount ?? 0;
  const myRank = global?.myRank ?? 0;
  const meVisible = entries.some((e) => e.isCurrentUser);
  // Der Server zählt einen selbst immer mit — ohne Freunde wäre man "allein
  // auf Platz 1". Dann lieber der Einladen-Hinweis statt einer Ein-Personen-Liste.
  const showEmpty = tab === "friends" ? friendCount === 0 : entries.length === 0;
  // Reihenfolge wie in der App: Silber links, Gold in der Mitte, Bronze rechts.
  const podium = entries.length >= 3 ? [entries[1], entries[0], entries[2]] : [];
  // Eigene Werte für die Übersichts-Karte: die Freunde-Liste enthält einen
  // selbst immer — LP und Streak stimmen dort auch, wenn man global nicht in
  // den Top 50 steht.
  const myEntry = friends?.entries.find((e) => e.isCurrentUser) ?? null;
  const shownRank = tab === "global" ? myRank : (myEntry?.rank ?? 0);

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Zurück"
            style={{
              color: "var(--ink-2)",
              display: "inline-flex",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Rangliste <Crown size={24} style={{ color: "var(--amber)" }} fill="var(--amber)" />
            </h1>
            <p className="muted" style={{ marginTop: 4 }}>
              {tab === "global" && myRank > 0 && <>Dein Rang: #{myRank} · </>}
              Vergleiche dich mit anderen Lernenden
            </p>
          </div>
        </div>
        <div className="lbx-tabs" role="tablist" aria-label="Rangliste umschalten">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "global"}
            className={`lbx-tab${tab === "global" ? " is-on" : ""}`}
            onClick={() => setTab("global")}
          >
            <Globe size={14} /> Global
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "friends"}
            className={`lbx-tab${tab === "friends" ? " is-on" : ""}`}
            onClick={() => setTab("friends")}
          >
            <Users size={14} /> Freunde ({friendCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lbx-center">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="lbx-center">
          <p className="muted">Rangliste konnte nicht geladen werden.</p>
          <button type="button" className="btn btn-primary" onClick={load}>
            Erneut versuchen
          </button>
        </div>
      ) : showEmpty ? (
        <div className="lbx-center">
          <Users size={40} style={{ color: "var(--ink-3)" }} />
          <p style={{ fontWeight: 700 }}>
            {tab === "friends" ? "Noch keine Freunde" : "Keine Einträge gefunden."}
          </p>
          {tab === "friends" && (
            <>
              <p className="muted" style={{ marginTop: -6 }}>
                Lade Freunde ein, um hier gemeinsam anzutreten.
              </p>
              <Link
                href="/dashboard/friends/add"
                className="btn btn-primary"
                style={{ gap: 8, textDecoration: "none" }}
              >
                <UserPlus size={16} /> Freunde einladen
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="lbx">
          <div className="lbx-side">
            {podium.length === 3 && (
              <div className="lbx-card lbx-card--pod">
                <div className="lbx-podium" aria-hidden>
                  {podium.map((entry, i) => {
                    if (!entry) return null;
                    const color = PODIUM_COLORS[i] ?? "var(--line)";
                    return (
                      <div key={entry.rank} className="lbx-pod">
                        <span
                          className={`lbx-pod__ava${entry.isCurrentUser ? " is-me" : ""}`}
                          style={{ borderColor: color }}
                        >
                          {(entry.displayName?.[0] ?? "?").toUpperCase()}
                        </span>
                        <span className="lbx-pod__name">{entry.displayName}</span>
                        <span
                          className="lbx-pod__bar"
                          style={{
                            height: PODIUM_HEIGHTS[i],
                            backgroundColor: `${color}33`,
                            color,
                          }}
                        >
                          {entry.rank}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nur am Desktop sichtbar — am Handy steht der Rang wie in der
                App im Seitenkopf. */}
            <div className="lbx-card lbx-me-card">
              <div className="lbx-me-card__head">Deine Platzierung</div>
              <div className="lbx-me-row">
                <Trophy size={16} /> Rang
                <b>{shownRank > 0 ? `#${shownRank}` : "–"}</b>
              </div>
              <div className="lbx-me-row">
                <Zap size={16} /> Lernpunkte
                <b>{myEntry ? myEntry.lpBalance.toLocaleString("de-DE") : "–"}</b>
              </div>
              <div className="lbx-me-row">
                <Flame size={16} /> Streak
                <b>
                  {myEntry
                    ? `${myEntry.currentStreak} ${myEntry.currentStreak === 1 ? "Tag" : "Tage"}`
                    : "–"}
                </b>
              </div>
            </div>
          </div>

          <div className="lbx-list">
            {entries.map((entry) => (
              <Row key={entry.rank} entry={entry} />
            ))}
            {/* Außerhalb der Top 50: eigene Zeile mit echtem Rang anhängen,
                damit man sich immer sieht (wie die Mini-Karte im Profil). */}
            {tab === "global" && !meVisible && myRank > 0 && (
              <div className="lbx-row lbx-row--me">
                <span className="lbx-row__badge">
                  <span className="lbx-rank">{myRank}</span>
                </span>
                <span className="lbx-row__name">Du</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
