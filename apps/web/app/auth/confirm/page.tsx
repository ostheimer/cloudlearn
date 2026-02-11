export default function AuthConfirmPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#f8f9fa",
      }}
    >
      <div style={{ fontSize: "64px", marginBottom: "1rem" }}>✅</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
        E-Mail bestätigt!
      </h1>
      <p style={{ fontSize: "1.1rem", color: "#6b7280", maxWidth: "400px", lineHeight: 1.6 }}>
        Dein Konto ist jetzt aktiv. Öffne die <strong>clearn</strong> App auf deinem Handy und melde dich an.
      </p>
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem 2rem",
          background: "#6366f1",
          color: "#fff",
          borderRadius: "12px",
          fontSize: "1.1rem",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        🧠 Jetzt in der App anmelden
      </div>
      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#9ca3af" }}>
        clearn.ai — Foto → Flashcards → Wissen
      </p>
    </div>
  );
}
