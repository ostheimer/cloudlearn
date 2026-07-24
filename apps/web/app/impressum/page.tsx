import type { Metadata } from "next";
import { ContentPage, PageLink, PageSection } from "../../src/components/content-page";
import { siteConfig } from "../../src/lib/site";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <ContentPage
      eyebrow="Impressum"
      title="Impressum & Kontakt"
      lead="Öffentliche Kontakt- und Anbieterinformationen für clearn."
    >
      <PageSection title="Anbieter">
        <p style={{ margin: 0 }}>
          {siteConfig.companyName}
          <br />
          {siteConfig.contactPeople}
          <br />
          UID: {siteConfig.uid}
          <br />
          {siteConfig.companyRegister}
          <br />
          {siteConfig.streetAddress}
          <br />
          {siteConfig.postalCode} {siteConfig.city}
        </p>
      </PageSection>

      <PageSection title="Kontakt">
        <p style={{ margin: 0 }}>
          Telefon (mobil): <a href={siteConfig.supportPhoneHref} style={{ color: "#4338ca", fontWeight: 700 }}>{siteConfig.supportPhone}</a>
          <br />
          E-Mail-Adresse:{" "}
          <a href={siteConfig.supportMailto} style={{ color: "#4338ca", fontWeight: 700 }}>
            {siteConfig.supportEmail}
          </a>
        </p>
      </PageSection>

      <PageSection title="EU-Streitschlichtung">
        <p style={{ margin: 0 }}>
          Verbraucher haben die Möglichkeit, Beschwerden an die Online-Streitbeilegungsplattform der EU zu richten:{" "}
          <a href="https://ec.europa.eu/consumers/odr" style={{ color: "#4338ca", fontWeight: 700 }}>
            ec.europa.eu/consumers/odr
          </a>
          . Sie können allfällige Beschwerden auch an die oben angegebene E-Mail-Adresse richten.
        </p>
      </PageSection>

      <PageSection title="Haftung für Inhalte dieser Webseite">
        <p style={{ margin: 0 }}>
          Wir entwickeln die Inhalte dieser Webseite ständig weiter und bemühen uns korrekte und aktuelle Informationen bereitzustellen. Leider können wir keine Haftung für die Korrektheit aller Inhalte auf dieser Webseite übernehmen, speziell für jene die seitens Dritter bereitgestellt werden. Sollten Ihnen problematische oder rechtswidrige Inhalte auffallen, bitten wir Sie uns umgehend zu kontaktieren, Sie finden die Kontaktdaten im Impressum.
        </p>
      </PageSection>

      <PageSection title="Haftungsausschluss">
        <p style={{ margin: 0 }}>
          Unsere Webseite enthält Links zu anderen Webseiten für deren Inhalt wir nicht verantwortlich sind. Wenn Ihnen rechtswidrige Links auf unserer Webseite auffallen, bitten wir Sie uns zu kontaktieren, Sie finden die Kontaktdaten im Impressum.
        </p>
      </PageSection>

      <PageSection title="Urheberrechtshinweis">
        <p style={{ margin: 0 }}>
          Alle Inhalte dieser Webseite (Bilder, Fotos, Texte, Videos) unterliegen dem Urheberrecht. Falls notwendig, werden wir die unerlaubte Nutzung von Teilen der Inhalte unserer Seite rechtlich verfolgen.
        </p>
      </PageSection>

      <PageSection title="Bildernachweis">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>iStockphoto.com</li>
          <li>Ostheimer Webdesign & Online-Marketing</li>
          <li>AdSimple</li>
          <li>OpenAI (KI-generierte Bilder)</li>
          <li>Google (Gemini KI-generierte Bilder)</li>
        </ul>
      </PageSection>

      <PageSection title="Hinweis">
        <p style={{ margin: 0 }}>
          Quelle der Angaben: öffentliches Impressum von ostheimer.at.
        </p>
      </PageSection>

      <PageSection title="Schnelle Wege">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <PageLink href={siteConfig.supportPath}>Support öffnen</PageLink>
          <PageLink href={siteConfig.privacyPath}>Datenschutz lesen</PageLink>
        </div>
      </PageSection>
    </ContentPage>
  );
}
