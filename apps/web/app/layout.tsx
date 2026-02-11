import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, sans-serif", background: "#f7f7fb" }}>
        {children}
      </body>
    </html>
  );
}
