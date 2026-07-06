import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

export default function SharedDeckNotFound() {
  return (
    <SiteFrame>
      <section
        style={{
          padding: "34px 28px",
          borderRadius: 28,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(15,23,42,0.08)",
          display: "grid",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 32, color: "#0f172a" }}>
          Dieser Teilen-Link ist ungültig oder abgelaufen
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, maxWidth: 640 }}>
          Das geteilte Deck wurde nicht gefunden. Vielleicht wurde es gelöscht, oder der Link
          wurde nicht vollständig kopiert. Frag am besten die Person, die den Link geteilt hat,
          nach einem neuen.
        </p>
        <Link href="/" style={{ color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>
          Mehr über clearn erfahren
        </Link>
      </section>
    </SiteFrame>
  );
}
