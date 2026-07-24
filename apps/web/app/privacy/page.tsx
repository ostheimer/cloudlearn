import type { Metadata } from "next";
import { ContentPage, PageLink, PageSection } from "../../src/components/content-page";
import { siteConfig } from "../../src/lib/site";

export const metadata: Metadata = { title: "Datenschutz" };

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Datenschutz"
      title="Datenschutz für clearn"
      lead="Diese kompakte Datenschutzseite beschreibt, welche Daten clearn für Anmeldung, Synchronisierung, Käufe und Support verarbeitet."
    >
      <PageSection title="Verantwortliche Stelle">
        <p style={{ margin: 0 }}>
          Verantwortlich für die Verarbeitung im Rahmen von clearn ist {siteConfig.companyName}, vertreten durch{" "}
          {siteConfig.contactPeople}. Kontakt für Datenschutzfragen:{" "}
          <a href={siteConfig.supportMailto} style={{ color: "#4338ca", fontWeight: 700 }}>
            {siteConfig.supportEmail}
          </a>
          .
        </p>
      </PageSection>

      <PageSection title="Welche Daten verarbeitet werden">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Kontodaten wie E-Mail-Adresse und technische Sitzungsinformationen</li>
          <li>Lerninhalte, die du importierst oder in Decks und Karten speicherst</li>
          <li>Subscription- und Kaufstatus, soweit er für Pro- oder Lifetime-Funktionen nötig ist</li>
          <li>Technische Fehler- und Nutzungsdaten, soweit sie zur Stabilität und zum Support erforderlich sind</li>
          <li>Einstellungen wie Sprache, Theme oder Erinnerungszeiten</li>
        </ul>
      </PageSection>

      <PageSection title="Wofür die Daten genutzt werden">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Bereitstellung von Anmeldung, Synchronisierung und Lernfunktionen</li>
          <li>Abwicklung von Käufen, Entitlements und Wiederherstellungen</li>
          <li>Support, Fehleranalyse und Missbrauchsschutz</li>
          <li>Erinnerungen und produktbezogene Einstellungen nur, wenn du sie aktivierst</li>
        </ul>
      </PageSection>

      <PageSection title="Eingesetzte Dienstleister">
        <p style={{ margin: 0 }}>
          Je nach Funktionsbereich nutzt clearn technische Dienstleister wie Supabase, Vercel, RevenueCat und Cloudflare R2. Zahlungs- und Store-bezogene Vorgänge laufen zusätzlich über Apple bzw. Google.
        </p>
      </PageSection>

      <PageSection title="Deine Rechte">
        <p style={{ margin: 0 }}>
          Du kannst Auskunft, Berichtigung oder Löschung deiner Daten anfragen. Die Konto-Löschung kannst du direkt in der App anstoßen oder alternativ über den Support-Kontakt anfragen.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <PageLink href={siteConfig.supportPath}>Support öffnen</PageLink>
          <PageLink href={siteConfig.supportMailto} external>
            Datenschutz per E-Mail
          </PageLink>
        </div>
      </PageSection>

      <PageSection title="Ansprechpartner">
        <p style={{ margin: 0 }}>
          {siteConfig.companyName}
          <br />
          {siteConfig.contactPeople}
          <br />
          {siteConfig.streetAddress}
          <br />
          {siteConfig.postalCode} {siteConfig.city}
          <br />
          {siteConfig.country}
        </p>
      </PageSection>
    </ContentPage>
  );
}
