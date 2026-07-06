import { getEnv } from "./env";

/**
 * Builds the public URL for a shared deck. The host comes from
 * SHARE_LINK_BASE_URL, so switching to a custom domain later (e.g.
 * https://clearn.ai) is a pure config change.
 */
export function buildShareUrl(
  shareToken: string,
  baseUrl: string = getEnv().SHARE_LINK_BASE_URL
): string {
  return `${baseUrl.replace(/\/+$/, "")}/deck/${encodeURIComponent(shareToken)}`;
}
