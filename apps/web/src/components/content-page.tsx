import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFrame } from "./site-frame";

export function ContentPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <SiteFrame>
      <section
        style={{
          padding: "28px 28px 24px",
          borderRadius: 28,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88) 58%, rgba(79,70,229,0.82))",
          color: "#f8fafc",
          boxShadow: "0 24px 70px rgba(15,23,42,0.12)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            marginBottom: 14,
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            color: "#cbd5f5",
            fontWeight: 700,
            letterSpacing: 0.2,
            fontSize: 13,
          }}
        >
          {eyebrow}
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: 42, lineHeight: 1.05 }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 720, fontSize: 18, lineHeight: 1.6, color: "#dbe4ff" }}>
          {lead}
        </p>
      </section>

      <article
        style={{
          marginTop: 22,
          padding: 24,
          borderRadius: 24,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 22px 60px rgba(15,23,42,0.08)",
        }}
      >
        {children}
      </article>
    </SiteFrame>
  );
}

export function PageSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} style={{ marginBottom: 28 }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 24, color: "#111827" }}>{title}</h2>
      <div style={{ display: "grid", gap: 10, color: "#334155", lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export function PageLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    borderRadius: 14,
    textDecoration: "none",
    fontWeight: 700,
    background: "#111827",
    color: "#f8fafc",
  } as const;

  if (external) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} style={style}>
      {children}
    </Link>
  );
}
