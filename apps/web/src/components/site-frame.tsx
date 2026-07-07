import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * Chrome for contained content pages (Support, Datenschutz, Impressum,
 * geteilte Decks). The marketing landing page composes SiteHeader / sections
 * / SiteFooter directly so its sections can span the full viewport width.
 */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </>
  );
}
