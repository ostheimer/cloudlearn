import { useLocalSearchParams } from "expo-router";
import LearnScreen from "../(tabs)/learn";

// Full-screen "Karteikarten" session for a single deck. Reuses the review UI
// from the (parked) learn tab, but scoped to one deck via its id.
export default function DeckReviewScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  return <LearnScreen deckId={id} deckTitle={title} />;
}
