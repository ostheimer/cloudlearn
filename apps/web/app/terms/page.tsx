import type { Metadata } from "next";
import { ContentPage, PageLink, PageSection } from "../../src/components/content-page";
import { siteConfig } from "../../src/lib/site";

export const metadata: Metadata = { title: "Nutzungsbedingungen" };

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Nutzungsbedingungen"
      title="Nutzungsbedingungen für clearn"
      lead="Diese Bedingungen regeln, wie du clearn nutzen kannst — auf der Website und in der App."
    >
      <PageSection title="Geltungsbereich">
        <p style={{ margin: 0 }}>
          Diese Nutzungsbedingungen gelten für die Nutzung von clearn über {siteConfig.brandName}{" "}
          im Web sowie über die clearn-App für iOS und Android. Anbieter ist {siteConfig.companyName}
          , {siteConfig.contactPeople}. Mit der Registrierung oder Nutzung von clearn erklärst du dich
          mit diesen Bedingungen einverstanden.
        </p>
      </PageSection>

      <PageSection title="Leistungsbeschreibung und Konto">
        <p style={{ margin: 0 }}>
          clearn hilft dir, aus Fotos, Texten, URLs und PDFs Karteikarten zu erstellen und diese mit
          Wiederholungslogik zu lernen. Manche Funktionen — etwa Scans, Synchronisierung über mehrere
          Geräte, Lernfortschritt und Käufe — sind erst mit einem Konto nutzbar. Du bist dafür
          verantwortlich, deine Zugangsdaten geheim zu halten und uns bei Verdacht auf Missbrauch zu
          informieren.
        </p>
      </PageSection>

      <PageSection title="Käufe, Abonnements und Zahlung">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Bezahlte Funktionen (z. B. clearn Pro, Lifetime, Lernpunkte-Pakete) kaufst du über den App Store oder Google Play; Preise, Abrechnung und Kündigung laufen über dein jeweiliges Store-Konto.</li>
          <li>Abonnements verlängern sich automatisch, bis du sie in den Store-Einstellungen kündigst — clearn selbst kann ein laufendes Abo nicht direkt beenden.</li>
          <li>Rückerstattungen richten sich nach den Regeln von Apple bzw. Google, nicht nach dieser Seite.</li>
        </ul>
      </PageSection>

      <PageSection title="Widerrufsrecht bei digitalen Inhalten">
        <p style={{ margin: 0 }}>
          Für digitale Inhalte, die sofort verfügbar gemacht werden, kann das gesetzliche
          Widerrufsrecht vorzeitig erlöschen, wenn du der sofortigen Ausführung ausdrücklich zustimmst
          und deine Zustimmung im Kaufvorgang von Apple oder Google bestätigst. Die genaue
          Widerrufsbelehrung zeigt dir der jeweilige Store beim Kauf.
        </p>
      </PageSection>

      <PageSection title="Deine Inhalte und Nutzungsregeln">
        <p style={{ margin: 0 }}>
          Lernmaterial, das du importierst oder in Decks und Karten speicherst, bleibt dein Eigentum.
          Du erlaubst uns, diese Inhalte technisch zu verarbeiten, um dir clearn bereitzustellen
          (z. B. Texterkennung, Speicherung, Synchronisierung). Bitte lade keine Inhalte hoch, die
          gegen geltendes Recht verstoßen oder Rechte Dritter verletzen. Marken- und Urheberrechte an
          clearn selbst (Name, Logo, Gestaltung) verbleiben bei {siteConfig.companyName}.
        </p>
      </PageSection>

      <PageSection title="Haftung">
        <p style={{ margin: 0 }}>
          Wir bemühen uns um einen zuverlässigen Betrieb von clearn, können eine ununterbrochene
          Verfügbarkeit aber nicht garantieren. Für leicht fahrlässig verursachte Schäden haften wir
          nur bei Verletzung wesentlicher Vertragspflichten. Die gesetzliche Haftung für Vorsatz, grobe
          Fahrlässigkeit sowie Personenschäden bleibt davon unberührt.
        </p>
      </PageSection>

      <PageSection title="Laufzeit, Kündigung und Änderungen">
        <p style={{ margin: 0 }}>
          Du kannst dein Konto jederzeit im Profil endgültig löschen; das beendet nicht automatisch ein
          laufendes Store-Abo. Wir dürfen ein Konto bei schwerwiegendem oder wiederholtem Verstoß gegen
          diese Bedingungen sperren. Wir können diese Nutzungsbedingungen ändern, wenn sich clearn oder
          rechtliche Vorgaben ändern; wesentliche Änderungen kündigen wir in der App oder auf dieser
          Seite an.
        </p>
      </PageSection>

      <PageSection title="Anwendbares Recht und Ansprechpartner">
        <p style={{ margin: 0 }}>
          Es gilt österreichisches Recht unter Ausschluss des UN-Kaufrechts. Zwingende
          verbraucherschutzrechtliche Bestimmungen deines Wohnsitzlandes bleiben davon unberührt.
        </p>
        <p style={{ margin: 0 }}>
          {siteConfig.companyName}
          <br />
          {siteConfig.contactPeople}
          <br />
          {siteConfig.streetAddress}
          <br />
          {siteConfig.postalCode} {siteConfig.city}, {siteConfig.country}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <PageLink href={siteConfig.privacyPath}>Datenschutz lesen</PageLink>
          <PageLink href={siteConfig.impressumPath}>Impressum ansehen</PageLink>
          <PageLink href={siteConfig.supportMailto} external>
            Fragen an den Support
          </PageLink>
        </div>
      </PageSection>
    </ContentPage>
  );
}
