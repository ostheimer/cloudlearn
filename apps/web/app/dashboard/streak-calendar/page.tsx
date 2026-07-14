"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getStats,
  getStreakCalendar,
  type StatsResponse,
  type StreakCalendarResponse,
} from "@/lib/api";
import { ArrowLeft, Award, ChevronLeft, ChevronRight, Flame, Shield } from "@/components/icons";

// Lokales Kalenderdatum (sv-SE rendert YYYY-MM-DD) passt zu den Server-Streak-
// Tagen in Berlin-Zeit — toISOString() würde um Mitternacht UTC umkippen (#211).
function todayLocalDate(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = (total % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y ?? 0, m ?? 1, 0).getDate();
}

/** Spalte des Monatsersten in einer Montag-ersten Woche (Mo = 0). */
function firstWeekdayOffset(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return (new Date(y ?? 0, (m ?? 1) - 1, 1).getDay() + 6) % 7;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function StreakCalendarPage() {
  const currentMonth = todayLocalDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [calendar, setCalendar] = useState<StreakCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Stats einmal laden (Chips); die Kalenderdaten je Monat separat.
  useEffect(() => {
    getStats()
      .then((res) => setStats(res.stats))
      .catch(() => {
        /* letzte bekannten Werte behalten; Chips zeigen einen Platzhalter */
      });
  }, []);

  const loadMonth = useCallback((m: string) => {
    setLoading(true);
    setError(false);
    getStreakCalendar(m)
      .then((res) => setCalendar(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMonth(month);
  }, [month, loadMonth]);

  const today = todayLocalDate();
  const learned = new Set(calendar?.learnedDays ?? []);
  const frozen = new Set(calendar?.frozenDays ?? []);
  const atCurrentMonth = month >= currentMonth;

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y ?? 0, (m ?? 1) - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  const offset = firstWeekdayOffset(month);
  const dayCount = daysInMonth(month);
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ];

  const streakFreezes = stats?.streakFreezes ?? 0;

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/dashboard/home"
            aria-label="Zurück zur Startseite"
            style={{ color: "var(--ink-2)", display: "inline-flex" }}
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1>Streak-Kalender</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              An welchen Tagen du gelernt hast
            </p>
          </div>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="cal-chips" style={{ marginBottom: 16 }}>
        <div className="cal-chip cal-chip--streak">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Flame size={16} style={{ color: "var(--amber)" }} />
            <b style={{ color: "var(--amber)" }}>{stats ? stats.currentStreak : "–"}</b>
          </span>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Aktuell
          </span>
        </div>
        <div className="cal-chip">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Shield size={16} style={{ color: "var(--amber)" }} />
            <b>{stats ? streakFreezes : "–"}</b>
          </span>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Freezes
          </span>
        </div>
        <div className="cal-chip">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Award size={16} style={{ color: "var(--ink-3)" }} />
            <b>{stats ? stats.longestStreak : "–"}</b>
          </span>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Bestwert
          </span>
        </div>
      </div>

      {/* Monatskalender */}
      <div className="panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            className="icon-btn"
            aria-label="Vorheriger Monat"
            onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
          >
            <ChevronLeft size={22} />
          </button>
          <h3 className="h3" style={{ margin: 0 }}>
            {monthLabel}
          </h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="Nächster Monat"
            disabled={atCurrentMonth}
            onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="cal">
          {WEEKDAYS.map((label) => (
            <div key={label} className="cal-wd">
              {label}
            </div>
          ))}
        </div>

        {loading && !calendar ? (
          <div className="spinner" style={{ margin: "24px auto" }} />
        ) : error ? (
          <p className="muted" style={{ textAlign: "center", padding: "20px 0" }}>
            Kalender konnte nicht geladen werden.
          </p>
        ) : (
          <div className="cal" style={{ marginTop: 4 }}>
            {cells.map((day, index) => {
              if (day === null) return <div key={`e-${index}`} />;
              const dateStr = `${month}-${String(day).padStart(2, "0")}`;
              const isFrozen = frozen.has(dateStr);
              const isLearned = !isFrozen && learned.has(dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const cls =
                "cal-cell" +
                (isLearned ? " cal-cell--learned" : "") +
                (isToday ? " cal-cell--today" : isFrozen ? " cal-cell--frozen" : "") +
                (isFuture && !isLearned && !isFrozen ? " cal-cell--future" : "");
              return (
                <div key={dateStr} className={cls}>
                  {isFrozen ? (
                    <Shield size={15} style={{ color: "var(--amber)" }} />
                  ) : isLearned ? (
                    <Flame size={15} style={{ color: "var(--amber)" }} />
                  ) : (
                    day
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legende */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 14,
            fontSize: "0.78rem",
            color: "var(--ink-3)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Flame size={14} style={{ color: "var(--amber)" }} /> Gelernt
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Shield size={14} style={{ color: "var(--amber)" }} /> Durch Freeze geschützt
          </span>
          <span>Leere Tage: nicht gelernt</span>
        </div>
      </div>

      {/* Freezes nachkaufen */}
      <Link
        href="/dashboard/lp"
        className="btn btn-ghost btn-block"
        style={{ marginTop: 16, textDecoration: "none", gap: 8 }}
      >
        <Shield size={18} /> Streak-Schutz kaufen
      </Link>
    </>
  );
}
