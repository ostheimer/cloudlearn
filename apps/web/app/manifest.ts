import type { MetadataRoute } from "next";

// PWA-Steckbrief („Web App Manifest"). Ohne diese Datei legt Chrome am Handy nur
// eine Browser-Verknüpfung an: kleines Symbol, Adressleiste bleibt sichtbar.
// Mit ihr bietet Android „App installieren" an und clearn startet vom
// Startbildschirm im Vollbild — so wie die iPhone-/Android-App.
//
// Next.js liefert diese Route unter /manifest.webmanifest aus und setzt den
// <link rel="manifest"> selbst in den <head>; in app/layout.tsx ist dafür
// nichts nötig.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` hält die App-Identität stabil, auch wenn sich start_url später ändert.
    id: "/",
    name: "clearn — Aus Lernmaterial werden Flashcards",
    short_name: "clearn",
    description:
      "clearn verwandelt Fotos, PDFs, Texte und URLs in klare Lernkarten und bringt dir mit Spaced Repetition genau die Karten, die heute dran sind.",
    // Installiert startet clearn auf der Home-Seite (wie der Home-Tab der App).
    // Ohne Login schickt der Guard in components/app/app-shell.tsx weiter
    // auf /login, danach landet man wieder hier.
    start_url: "/dashboard/home",
    // Die ganze Seite gehört zur App — auch /login, /onboarding und geteilte Decks.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "de-AT",
    dir: "ltr",
    // Ladebildschirm in Markenfarbe, gleich wie der App-Splash in
    // apps/mobile/app.json (splash.backgroundColor).
    background_color: "#4F46E5",
    theme_color: "#4F46E5",
    categories: ["education", "productivity"],
    // "maskable" erlaubt Android, das Symbol in seine eigene Form (Kreis,
    // Squircle) zu schneiden, statt einen weißen Rand darum zu legen. Dieselben
    // Dateien taugen für beide Zwecke, weil das Zeichen nur ~37 % der Fläche
    // einnimmt und damit klar innerhalb der Sicherheitszone liegt — laut
    // Standard wäre purpose: "any maskable" erlaubt, der Next-Typ nimmt aber
    // nur einen Wert pro Eintrag, deshalb jede Datei zweimal.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
