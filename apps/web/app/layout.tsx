import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const siteUrl = "https://clearn.ai";
const description =
  "clearn verwandelt Fotos, PDFs, Texte und URLs in klare Lernkarten – und bringt dir mit Spaced Repetition genau die Karten, die heute dran sind. Erfassen, strukturieren, verankern.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "clearn.ai — Aus Lernmaterial werden Flashcards",
    template: "%s · clearn.ai",
  },
  description,
  applicationName: "clearn",
  keywords: [
    "Flashcards",
    "Lernkarten",
    "Spaced Repetition",
    "Karteikarten App",
    "Lernen",
    "OCR",
    "PDF zu Flashcards",
    "clearn",
  ],
  authors: [{ name: "Ostheimer OG" }],
  openGraph: {
    type: "website",
    locale: "de_AT",
    url: siteUrl,
    siteName: "clearn.ai",
    title: "clearn.ai — Aus Lernmaterial werden Flashcards",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "clearn.ai — Aus Lernmaterial werden Flashcards",
    description,
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    // Safari nutzt für „Zum Home-Bildschirm" nicht das Manifest, sondern dieses
    // Symbol — in der von Apple erwarteten Größe (180x180, ohne Transparenz).
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Set the saved theme on <html> before first paint so a forced light/dark
// choice doesn't flash the system theme first. "system" stores nothing → the
// CSS media query decides.
const themeScript = `try{var t=localStorage.getItem('clearn-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
