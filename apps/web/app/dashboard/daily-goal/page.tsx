"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { getStats, setDailyGoal, isApiError } from "@/lib/api";
import { ArrowLeft, Minus, Plus, Target } from "@/components/icons";

// Grenzen und Vorschläge exakt wie im App-Editor (apps/mobile/app/daily-goal.tsx);
// der Server begrenzt final auf [1, 500].
const MIN_GOAL = 1;
const MAX_GOAL = 500;
const DEFAULT_GOAL = 30;
const PRESETS = [10, 20, 30, 50, 100];

const clampGoal = (n: number) =>
  Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(n)));

// Tagesziel einstellen: Chips für die üblichen Werte + ein "− [Zahl] +"-Stepper
// für die Feinauswahl. Anders als die App (Param von Home) lädt die Seite den
// aktuellen Wert selbst aus /stats — so stimmt er auch bei direktem Aufruf.
export default function DailyGoalPage() {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/home");
  };

  useEffect(() => {
    let active = true;
    getStats()
      .then((res) => {
        if (active) setValue(clampGoal(res.stats.dailyGoal ?? DEFAULT_GOAL));
      })
      .catch(() => {
        // Ohne Stats trotzdem editierbar bleiben — wie die App ohne Param.
        if (active) setValue(DEFAULT_GOAL);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (value === null) return;
    setSaving(true);
    setMessage(null);
    try {
      await setDailyGoal(value);
      goBack();
    } catch (e) {
      setMessage(
        isApiError(e) && e.status === 401
          ? "Bitte melde dich neu an."
          : "Speichern fehlgeschlagen. Versuch es später noch einmal."
      );
      setSaving(false);
    }
  };

  const stepperButton = (disabled: boolean): CSSProperties => ({
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "var(--bg-softer)",
    border: "none",
    color: "var(--ink)",
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
  });

  if (value === null) return <div className="spinner" />;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "grid", gap: 16 }}>
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
        <h1 className="h2" style={{ margin: 0 }}>
          Tagesziel
        </h1>
      </div>

      {/* Intro — wie in der App: Zielscheibe + Leitfrage */}
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <span
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: "rgba(99,102,241,0.12)",
            color: "var(--brand)",
            display: "grid",
            placeItems: "center",
          }}
          aria-hidden
        >
          <Target size={30} />
        </span>
        <p className="muted" style={{ margin: 0, textAlign: "center" }}>
          Wie viele Karten möchtest du pro Tag lernen?
        </p>
      </div>

      {/* Ziel wählen — Presets zum Anklicken + Feinauswahl per Stepper */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginBottom: 12 }}>
          Karten pro Tag
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRESETS.map((goal) => {
            const active = value === goal;
            return (
              <button
                key={goal}
                type="button"
                onClick={() => setValue(goal)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  background: active ? "var(--brand)" : "var(--bg-softer)",
                  color: active ? "#fff" : "var(--ink)",
                }}
              >
                {goal}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setValue((v) => clampGoal((v ?? DEFAULT_GOAL) - 1))}
            disabled={value <= MIN_GOAL}
            aria-label="Ziel verringern"
            style={stepperButton(value <= MIN_GOAL)}
          >
            <Minus size={22} />
          </button>
          <div style={{ display: "grid", justifyItems: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--brand)", lineHeight: 1.1 }}>
              {value}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>Karten pro Tag</div>
          </div>
          <button
            type="button"
            onClick={() => setValue((v) => clampGoal((v ?? DEFAULT_GOAL) + 1))}
            disabled={value >= MAX_GOAL}
            aria-label="Ziel erhöhen"
            style={stepperButton(value >= MAX_GOAL)}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Speichern…" : "Speichern"}
      </button>

      {message && (
        <p style={{ fontSize: "0.85rem", color: "#dc2626", textAlign: "center", margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
