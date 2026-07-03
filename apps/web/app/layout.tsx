import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "clearn.ai",
  description: "Lern-App für strukturierte Flashcards, OCR und Review-Sessions.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, sans-serif", background: "#f7f7fb" }}>
        {children}
      </body>
    </html>
  );
}
