import Link from "next/link";
import { siteConfig, footerSections } from "@/lib/site";
import { GraduationCap } from "@/components/icons";

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
                <GraduationCap size={20} />
              </span>
              {siteConfig.brandName}
            </Link>
            {/* #609: Stand „strukturierte Flashcards — und Spaced Repetition
                sorgt dafür …". Erklärender Text spricht Deutsch; das
                Fachwort steht nur noch einmal auf der Startseite (in einer
                Klammer) und in den Angaben für Suchmaschinen. */}
            <p style={{ maxWidth: 320, color: "var(--ink-3)" }}>
              Aus Fotos, PDFs und Texten werden fertige Karteikarten — und clearn zeigt sie dir
              genau dann wieder, wenn du sie brauchst.
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
