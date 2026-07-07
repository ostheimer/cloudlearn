import Link from "next/link";
import { siteConfig, footerSections } from "@/lib/site";

function isInternal(href: string): boolean {
  return href.startsWith("/");
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Link href="/" className="brand" style={{ marginBottom: 14 }}>
              <span className="brand__mark" aria-hidden>
                🧠
              </span>
              {siteConfig.brandName}
            </Link>
            <p style={{ maxWidth: 320, color: "var(--ink-3)" }}>
              Aus Fotos, PDFs und Texten werden strukturierte Flashcards — und Spaced Repetition
              sorgt dafür, dass das Gelernte bleibt.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title} className="footer-col">
              <h4>{section.title}</h4>
              {section.links.map((link) =>
                isInternal(link.href) ? (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                )
              )}
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>
            © {siteConfig.companyName} · {siteConfig.city}, {siteConfig.country}
          </span>
          <span>{siteConfig.brandName} — Foto → Flashcards → Wissen</span>
        </div>
      </div>
    </footer>
  );
}
