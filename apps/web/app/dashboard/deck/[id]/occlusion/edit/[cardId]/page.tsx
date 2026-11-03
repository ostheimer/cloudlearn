"use client";
import { useParams } from "next/navigation";
import { OcclusionEditor } from "@/components/app/occlusion-editor";

export default function EditOcclusionImagePage() {
  const { cardId } = useParams<{ cardId: string }>();
  return <OcclusionEditor sourceCardId={cardId} />;
}
