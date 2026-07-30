import { MilestoneToastView } from "../../components/MilestoneToast";
import { MilestoneCelebration } from "../../components/MilestoneCelebration";
import { useMilestoneToast } from "./useMilestoneToast";

/**
 * Zeigt Meilenstein-Boni überall in der App (#637).
 *
 * Hängt EINMAL im Wurzel-Layout statt in einzelnen Bildschirmen: Ein Bonus
 * entsteht beim Anlegen eines Decks (Bibliothek, Scan, Import, geteiltes Deck)
 * genauso wie am Ende jeder Lernart und nach einer Prüfung. Vorher stand die
 * Anzeige nur im Karteikarten-Modus — alles andere blieb still, selbst wenn
 * der Bonus geflossen wäre.
 */
export function MilestoneHost() {
  const { toast, celebration, dismissCelebration } = useMilestoneToast();

  return (
    <>
      <MilestoneToastView toast={toast} />
      <MilestoneCelebration celebration={celebration} onDismiss={dismissCelebration} />
    </>
  );
}
