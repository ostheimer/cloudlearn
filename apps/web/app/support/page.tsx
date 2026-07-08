import { ContentPage, PageLink, PageSection } from "../../src/components/content-page";
import { siteConfig } from "../../src/lib/site";

export default function SupportPage() {
  return (
    <ContentPage
      eyebrow="Support"
      title="Hilfe für clearn"
      lead="Hier landet alles, was für App Store, Beta und tägliche Nutzung wichtig ist: Support-Kontakt, typische Themen und der schnellste Weg zur Lösung."
    >
      <PageSection id="beta" title="Direkter Kontakt">
        <p style={{ margin: 0 }}>
          Für Fragen zu Anmeldung, Import, Käufen, Datenschutz oder technischen Problemen erreichst du uns direkt bei {siteConfig.companyName}.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <PageLink href={siteConfig.supportMailto} external>
            E-Mail schreiben
          </PageLink>
          <PageLink href={siteConfig.supportPhoneHref} external>
            Anrufen
          </PageLink>
          <span style={{ alignSelf: "center", fontWeight: 600, color: "#0f172a" }}>
            {siteConfig.supportEmail}
          </span>
        </div>
      </PageSection>

      <PageSection title="Wobei wir helfen">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Anmeldung, Passwort-Reset und E-Mail-Bestätigung</li>
          <li>PDF-, Bild-, Text- oder URL-Import</li>
          <li>Lernpunkte, Pro, Lifetime, Käufe und Wiederherstellung</li>
          <li>Datenschutzanfragen und Konto-Löschung</li>
          <li>Beta-Feedback und reproduzierbare Bugs</li>
        </ul>
      </PageSection>

      <PageSection title="Kontakt">
        <p style={{ margin: 0 }}>
          {siteConfig.companyName}
          <br />
          {siteConfig.streetAddress}
          <br />
          {siteConfig.postalCode} {siteConfig.city}
          <br />
          {siteConfig.country}
          <br />
          Telefon: {siteConfig.supportPhone}
          <br />
          E-Mail: {siteConfig.supportEmail}
        </p>
      </PageSection>

      <PageSection title="Für schnelle Hilfe mitschicken">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Gerät, Betriebssystem und App-Version</li>
          <li>Welche Funktion betroffen ist, zum Beispiel Scan, Lernen oder Paywall</li>
          <li>Eine kurze Beschreibung des Problems und nach Möglichkeit ein Screenshot</li>
        </ul>
      </PageSection>

      <PageSection title="Relevante Links">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <PageLink href={siteConfig.privacyPath}>Datenschutz lesen</PageLink>
          <PageLink href={siteConfig.impressumPath}>Impressum öffnen</PageLink>
        </div>
      </PageSection>
    </ContentPage>
  );
}
