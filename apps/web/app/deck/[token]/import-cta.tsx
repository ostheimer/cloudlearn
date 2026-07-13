"use client";

import { useEffect, useState } from "react";

function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipod|android/i.test(ua)) return true;
  // iPadOS 13+ reports as "Macintosh" but has touch points
  return /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * On a phone, offers a deep link into the clearn app so the recipient can save
 * the shared deck as their own copy. Rendered as null on desktop, where the
 * clearn:// scheme wouldn't resolve (avoids a dead button).
 */
export function ImportInAppCta({ token }: { token: string }) {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  if (!mobile) return null;

  return (
    <a
      href={`clearn://deck/share/${encodeURIComponent(token)}`}
      style={{
        display: "inline-flex",
        textDecoration: "none",
        background: "#f8fafc",
        color: "#0f172a",
        borderRadius: 14,
        padding: "14px 18px",
        fontWeight: 800,
      }}
    >
      In der App übernehmen
    </a>
  );
}
