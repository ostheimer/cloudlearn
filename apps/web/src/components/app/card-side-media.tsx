import type { MarkdownImage } from "@/lib/card-display";

/** Images remain on their own side of a card, including quiz distractors. */
export function CardSideMedia({ images = [], concealCaption = false }: {
  images?: MarkdownImage[] | undefined; concealCaption?: boolean;
}) {
  if (!images.length) return null;
  return <span className="card-side-media">
    {images.map((image, i) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={`${image.url}-${i}`} src={image.url} alt={concealCaption ? `Fragebild ${i + 1}` : image.alt || `Kartenbild ${i + 1}`} draggable={false} />
    ))}
  </span>;
}
