"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  getFriendStreaks,
  getFriends,
  inviteFriendStreak,
  acceptFriendStreak,
  remindFriendStreak,
  leaveFriendStreak,
  type FriendStreak,
  type FriendProfile,
} from "@/lib/api";
import { ArrowLeft, Award, Bell, Check, Clock, Flame, UserPlus, Users, X } from "@/components/icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#d4537e", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6"];
function avatarColor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: avatarColor(id),
    color: "#fff",
    fontWeight: 600,
    fontSize: size / 2.8,
    display: "grid",
    placeItems: "center",
    flex: "none",
  };
  return (
    <span style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
  display: "grid",
  gap: 12,
};
const rowBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: "0.9rem",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

export default function FriendsPage() {
  const [streaks, setStreaks] = useState<FriendStreak[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/home");
  };

  const load = useCallback(() => {
    setLoadErr(false);
    Promise.all([getFriendStreaks(), getFriends()])
      .then(([s, f]) => {
        setStreaks(s.streaks);
        setFriends(f.friends);
      })
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (friendId: string, fn: () => Promise<unknown>) => {
      setBusyId(friendId);
      setMsg(null);
      try {
        await fn();
        load();
      } catch {
        setMsg("Das hat nicht geklappt. Versuch es später noch einmal.");
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const remind = (friendId: string, name: string) =>
    runAction(friendId, async () => {
      const res = await remindFriendStreak(friendId);
      setMsg(res.sent ? `${name} wurde erinnert.` : `${name} lässt sich gerade nicht erreichen.`);
    });

  const active = streaks.filter((s) => s.status === "active");
  const toAccept = streaks.filter((s) => s.status === "pending" && !s.invitedByYou);
  const sent = streaks.filter((s) => s.status === "pending" && s.invitedByYou);
  const inStreak = new Set(streaks.map((s) => s.friendId));
  const invitable = friends.filter((f) => !inStreak.has(f.userId));

  const nothing =
    active.length === 0 && toAccept.length === 0 && sent.length === 0 && invitable.length === 0;

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
            <h1>Freunde-Streak</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Haltet gemeinsam eine Lern-Serie
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/dashboard/friends/add"
        className="btn btn-primary btn-block"
        style={{ textDecoration: "none", gap: 8, marginBottom: 16 }}
      >
        <UserPlus size={18} /> Freund oder Freundin hinzufügen
      </Link>

      {msg && (
        <p className="muted" style={{ marginBottom: 12, fontSize: "0.9rem" }}>
          {msg}
        </p>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        // minmax(0, 1fr): Sonst richtet sich die Spalte nach dem sperrigsten
        // Kind — abgeschnittene Anzeigenamen melden trotz overflow:hidden ihre
        // volle Breite und würden die Seite am Handy aufblasen.
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
          {/* Aktive gemeinsame Streaks */}
          {active.map((s) => (
            <div key={s.friendId} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
                <Avatar id="me" name="Du" />
                <div style={{ display: "grid", placeItems: "center" }}>
                  <Flame size={30} style={{ color: "var(--amber)" }} />
                  <b style={{ color: "var(--amber)", fontSize: "1.1rem" }}>{s.currentStreak}</b>
                </div>
                <Avatar id={s.friendId} name={s.displayName} />
              </div>
              <p className="muted" style={{ textAlign: "center", fontSize: "0.9rem", margin: 0 }}>
                {s.currentStreak > 0
                  ? `${s.currentStreak} ${s.currentStreak === 1 ? "Tag" : "Tage"} gemeinsam mit ${s.displayName}`
                  : `Lernt beide heute, um mit ${s.displayName} zu starten`}
              </p>
              {s.longestStreak > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color: "var(--ink-4)",
                    fontSize: "0.78rem",
                  }}
                >
                  <Award size={13} /> Rekord: {s.longestStreak} {s.longestStreak === 1 ? "Tag" : "Tage"}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { done: s.youStudiedToday, label: `Du ${s.youStudiedToday ? "erledigt" : "offen"}` },
                  {
                    done: s.friendStudiedToday,
                    label: `${s.displayName} ${s.friendStudiedToday ? "erledigt" : "offen"}`,
                  },
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      background: "var(--bg-soft)",
                      borderRadius: 10,
                      padding: "8px 6px",
                      fontSize: "0.85rem",
                      minWidth: 0,
                    }}
                  >
                    {c.done ? (
                      <Check size={16} style={{ color: "var(--green)", flex: "none" }} />
                    ) : (
                      <Clock size={16} style={{ color: "var(--ink-4)", flex: "none" }} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>

              {!s.friendStudiedToday && (
                <button
                  type="button"
                  onClick={() => remind(s.friendId, s.displayName)}
                  disabled={busyId === s.friendId}
                  style={{
                    ...rowBtn,
                    width: "100%",
                    background: "rgba(99,102,241,0.12)",
                    color: "var(--brand)",
                  }}
                >
                  <Bell size={15} /> {s.displayName} erinnern
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Der gemeinsame Streak mit ${s.displayName} wird gelöscht.`)) {
                    runAction(s.friendId, () => leaveFriendStreak(s.friendId));
                  }
                }}
                disabled={busyId === s.friendId}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-4)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Streak beenden
              </button>
            </div>
          ))}

          {/* Einladungen, die auf meine Antwort warten */}
          {toAccept.map((s) => (
            <div
              key={s.friendId}
              style={{
                background: "var(--amber-50)",
                border: "1px solid var(--amber)",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Avatar id={s.friendId} name={s.displayName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{s.displayName}</b>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  lädt dich zu einem gemeinsamen Streak ein
                </p>
              </div>
              <button
                type="button"
                onClick={() => runAction(s.friendId, () => acceptFriendStreak(s.friendId))}
                disabled={busyId === s.friendId}
                style={{ ...rowBtn, background: "var(--amber)", color: "#fff" }}
              >
                Annehmen
              </button>
            </div>
          ))}

          {/* Von mir gesendete, noch offene Einladungen */}
          {sent.map((s) => (
            <div key={s.friendId} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar id={s.friendId} name={s.displayName} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{s.displayName}</b>
                  <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                    Einladung gesendet – wartet auf Antwort
                  </p>
                </div>
                <Clock size={18} style={{ color: "var(--ink-4)", flex: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => remind(s.friendId, s.displayName)}
                  disabled={busyId === s.friendId}
                  style={{ ...rowBtn, flex: 1, background: "rgba(99,102,241,0.12)", color: "var(--brand)" }}
                >
                  <Bell size={15} /> Erinnern
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Deine Einladung an ${s.displayName} wird entfernt.`)) {
                      runAction(s.friendId, () => leaveFriendStreak(s.friendId));
                    }
                  }}
                  disabled={busyId === s.friendId}
                  style={{ ...rowBtn, flex: 1, background: "var(--bg-soft)", color: "var(--ink-3)" }}
                >
                  <X size={15} /> Zurückziehen
                </button>
              </div>
            </div>
          ))}

          {/* Freunde ohne gemeinsamen Streak */}
          {invitable.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} style={{ color: "var(--brand)" }} />
                <b>Neuen Freunde-Streak starten</b>
              </div>
              {invitable.map((f) => (
                <div
                  key={f.userId}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Avatar id={f.userId} name={f.displayName} size={38} />
                  <span
                    style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {f.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => runAction(f.userId, () => inviteFriendStreak(f.userId))}
                    disabled={busyId === f.userId}
                    style={{ ...rowBtn, background: "var(--brand)", color: "#fff" }}
                  >
                    <UserPlus size={15} /> Einladen
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Leerzustand */}
          {loadErr ? (
            <div className="empty-state">
              <div className="ic" aria-hidden>
                <Users size={30} />
              </div>
              <h3>Konnte nicht geladen werden</h3>
              <p>Deine Freunde ließen sich gerade nicht laden.</p>
              <button type="button" className="btn btn-primary" onClick={load}>
                Neu laden
              </button>
            </div>
          ) : nothing ? (
            <div className="empty-state">
              <div className="ic" aria-hidden>
                <Users size={30} />
              </div>
              <h3>Noch keine Freunde</h3>
              <p>
                Nutze oben „Freund oder Freundin hinzufügen" — teile deinen Code oder gib den Code
                eines Freundes oder einer Freundin ein, dann könnt ihr gemeinsam einen Streak halten.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
