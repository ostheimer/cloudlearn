import { evaluateAnswer } from "@/lib/learningModes";

const preview = evaluateAnswer({
  mode: "mcq",
  correctAnswer: "B",
  userAnswer: "B"
});

export default function WebLearnPage() {
  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
      <h1>Web Lernmodus</h1>
      <p>Dieser Screen demonstriert den gemeinsamen Domain-Layer für Lernlogik.</p>
      <pre>{JSON.stringify(preview, null, 2)}</pre>
    </main>
  );
}
