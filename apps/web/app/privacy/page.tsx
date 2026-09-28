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
          <li>Kontodaten wie E-Mail-Adresse, Nutzer-ID, Anzeigename und technische Sitzungsinformationen</li>
          <li>Fotos, Texte, PDFs und andere Lerninhalte, die du importierst oder in Decks und Karten speicherst</li>
          <li>Subscription- und Kaufstatus, soweit er für Pro- oder Lifetime-Funktionen nötig ist</li>
          <li>Lernfortschritt, Kartenbewertungen und Lernzeiten für deine Wiederholungen und Statistiken</li>
          <li>Freundeverbindungen und gemeinsame Lern-Streaks, wenn du diese Funktionen nutzt</li>
          <li>
            Deine bei der Registrierung gewählte Anredeoption für Freunde; mit „Sag ich nicht“ kannst du auf eine Geschlechtsangabe verzichten
          </li>
          <li>Eine Gerätekennung für Push-Benachrichtigungen, wenn du Benachrichtigungen erlaubst</li>
          <li>Einstellungen wie Sprache, Theme oder Erinnerungszeiten</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          Gespeicherte Lerninhalte, Fortschritte, Käufe und Freundeverbindungen werden deinem Konto zugeordnet. Angemeldete Nutzer können in der globalen Rangliste deinen Anzeigenamen, ein vorhandenes Profilbild, deinen LP-Stand, deine Abo-Stufe und deinen aktuellen Lern-Streak sehen. Freunde sehen zusätzlich die für gemeinsame Lernfunktionen vorgesehenen Profil- und Fortschrittsangaben. clearn liest dafür kein Adressbuch deines Geräts aus.
        </p>
      </PageSection>

      <PageSection title="Wofür die Daten genutzt werden">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Bereitstellung von Anmeldung, Synchronisierung und Lernfunktionen</li>
          <li>Freundeverbindungen, gemeinsame Streaks und persönliche Lernstatistiken</li>
          <li>Abwicklung von Käufen, Entitlements und Wiederherstellungen</li>
          <li>Support, Fehleranalyse und Missbrauchsschutz</li>
          <li>Erinnerungen und produktbezogene Einstellungen nur, wenn du sie aktivierst</li>
        </ul>
      </PageSection>

      <PageSection title="Eingesetzte Dienstleister">
        <p style={{ margin: 0 }}>
          Je nach Funktionsbereich nutzt clearn technische Dienstleister wie Supabase einschließlich Supabase Storage, Vercel und RevenueCat. Für Push-Benachrichtigungen werden der Push-Token und die jeweilige Nachricht über den Expo Push Service sowie die Benachrichtigungsdienste von Apple bzw. Google verarbeitet. Für die KI-Erstellung von Karten werden ausgewählte Lerninhalte über die clearn-API an Google Gemini übermittelt. Zahlungs- und Store-bezogene Vorgänge laufen zusätzlich über Apple bzw. Google.
        </p>
      </PageSection>

      <PageSection title="Werbung und Absturzberichte in der iOS-Version 1.0">
        <p style={{ margin: 0 }}>
          Diese iOS-Version zeigt keine Werbung und verwendet kein Tracking über andere Apps oder Websites hinweg. Die Werbe-SDKs Google Mobile Ads und Google User Messaging Platform sind in dieser Version ausgeschlossen. Die optionale automatische Absturzmeldung mit Sentry ist deaktiviert. Die Tracking-Einstellungen aktivieren weder Werbung noch diese Absturzmeldung.
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
