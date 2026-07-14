// Image Occlusion — Supabase Storage helpers (#207). Split from ./occlusion so
// the pure helpers there stay unit-testable; these touch the network/device and
// mirror the web editor's upload + signed-url flow.
import { supabase } from "./supabase";
import { CARD_IMAGE_BUCKET, base64ToBytes } from "./occlusion";

// Upload a picked image (base64 from expo-image-picker) to the private
// card-images bucket. `path` must start with the user's id (bucket RLS). Throws
// on failure so the caller can roll back created cards, just like the web editor.
export async function uploadOcclusionImage(
  base64: string,
  contentType: string,
  path: string,
): Promise<void> {
  const bytes = base64ToBytes(base64);
  const { error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) {
    throw new Error(`Bild-Upload fehlgeschlagen: ${error.message}`);
  }
}

// Signed URL for a private card image (default 1h), for rendering in the study
// screen. Returns null instead of throwing so one broken image doesn't abort a
// whole session.
export async function getCardImageSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

// Best-effort cleanup of an uploaded image (used when card creation fails after
// the upload succeeded, to avoid orphaned files).
export async function removeCardImage(path: string): Promise<void> {
  await supabase.storage.from(CARD_IMAGE_BUCKET).remove([path]);
}
