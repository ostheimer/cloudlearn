"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getReferralInfo, addFriendByCode, isApiError } from "@/lib/api";
import { ArrowLeft, Copy, Gift, Share, UserPlus, Zap, CheckCircle } from "@/components/icons";

export default function FriendAddPage() {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [lpFromReferrals, setLpFromReferrals] = useState(0);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const loadInfo = useCallback(() => {
    getReferralInfo()
      .then((r) => {
        setMyCode(r.referralCode);
        setReferredCount(r.referredCount);
        setLpFromReferrals(r.lpEarnedFromReferrals);
      })
      .catch(() => {
        /* Code bleibt einfach verborgen */
      });
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const copyCode = useCallback(async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard nicht verfügbar */
    }
  }, [myCode]);

  const share = useCallback(async () => {
    if (!myCode) return;
    const text = `Füge mich auf clearn hinzu, dann halten wir einen gemeinsamen Lern-Streak und bekommen beide Lernpunkte! Mein Code: ${myCode}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* Teilen abgebrochen */
      }
    } else {
      copyCode();
    }
  }, [myCode, copyCode]);

  const handleAdd = useCallback(async () => {
    const code = input.trim().toUpperCase();
    if (code.length < 4) return;
    setAdding(true);
    setErrMsg(null);
    setAddedName(null);
    try {
      const res = await addFriendByCode(code);
      setInput("");
      setAddedName(res.friend.displayName);
      loadInfo();
    } catch (err) {
      const code2 = isApiError(err) ? err.code : undefined;
      setErrMsg(
        code2 === "CODE_NOT_FOUND"
          ? "Diesen Code gibt es nicht."
          : code2 === "SELF_ADD"
            ? "Das ist dein eigener Code."
            : code2 === "INVALID_CODE"
              ? "Bitte gib einen gültigen Code ein."
              : "Hinzufügen fehlgeschlagen. Versuch es später noch einmal."
      );
    } finally {
      setAdding(false);
    }
  }, [input, loadInfo]);

  const canAdd = input.trim().length >= 4 && !adding;

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/dashboard/friends"
            aria-label="Zurück zu den Freunden"
            style={{ color: "var(--ink-2)", display: "inline-flex" }}
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1>Freund hinzufügen</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Über euren Einladungs-Code
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
        {/* Bonus-Hinweis */}
        <div
          style={{
            display: "flex",
            gap: 12,
            background: "rgba(16,185,129,0.10)",
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <Gift size={22} style={{ color: "var(--green)", flex: "none" }} />
          <div>
            <div style={{ fontWeight: 600 }}>Zusammen lernen lohnt sich</div>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.88rem", lineHeight: 1.5 }}>
              Fügst du eine Freundin per Code hinzu, bekommt ihr beim ersten Mal beide Lernpunkte — und
              ihr könnt sofort einen gemeinsamen Streak starten.
            </p>
          </div>
        </div>

        {/* Dein eigener Code */}
        <div className="panel" style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Dein Freunde-Code
          </span>
          {myCode ? (
            <span style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: 3, color: "var(--brand)" }}>
              {myCode}
            </span>
          ) : (
            <div className="spinner" />
          )}
          <div style={{ display: "flex", gap: 10, alignSelf: "stretch" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={copyCode}
              disabled={!myCode}
              style={{ flex: 1, gap: 6, color: copied ? "var(--green)" : undefined }}
            >
              <Copy size={16} /> {copied ? "Kopiert" : "Kopieren"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={share}
              disabled={!myCode}
              style={{ flex: 1, gap: 6 }}
            >
              <Share size={16} /> Teilen
            </button>
          </div>
          {(referredCount > 0 || lpFromReferrals > 0) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.78rem",
                color: "var(--ink-4)",
              }}
            >
              <Zap size={13} /> {referredCount} geworben · {lpFromReferrals} LP verdient
            </span>
          )}
        </div>

        {/* Trenner */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ink-4)", fontSize: "0.85rem" }}>
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          oder
          <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        {/* Code einer Freundin eingeben */}
        <div style={{ display: "grid", gap: 8 }}>
          <label htmlFor="friend-code" className="muted" style={{ fontSize: "0.85rem" }}>
            Code einer Freundin eingeben
          </label>
          <input
            id="friend-code"
            className="input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value.toUpperCase());
              setErrMsg(null);
              setAddedName(null);
            }}
            placeholder="z. B. 6CEFC7C1"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            style={{ letterSpacing: 2, fontSize: "1.05rem" }}
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleAdd}
            disabled={!canAdd}
            style={{ gap: 8 }}
          >
            {adding ? (
              "Bitte warten…"
            ) : (
              <>
                <UserPlus size={18} /> Hinzufügen
              </>
            )}
          </button>

          {addedName && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(16,185,129,0.10)",
                border: "1px solid var(--green)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <CheckCircle size={20} style={{ color: "var(--green)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{addedName} ist jetzt dein Freund</div>
                <Link
                  href="/dashboard/friends"
                  style={{ fontSize: "0.85rem", color: "var(--brand)", textDecoration: "none" }}
                >
                  Zu deinen Freunden ›
                </Link>
              </div>
            </div>
          )}

          {errMsg && (
            <div className="form-error" role="alert">
              <span>{errMsg}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
