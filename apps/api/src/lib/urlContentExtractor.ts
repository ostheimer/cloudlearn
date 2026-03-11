import { Buffer } from "node:buffer";

const HTML_REQUEST_TIMEOUT_MS = 12_000;
const IMAGE_REQUEST_TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_IMAGE_BYTES = 3_500_000;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SUPPORTED_EXTENSIONS: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface ExtractedUrlImage {
  url: string;
  altText: string;
  contextText: string;
  componentHint: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

export interface ExtractedUrlContent {
  sourceUrl: string;
  pageTitle: string;
  extractedText: string;
  images: ExtractedUrlImage[];
}

interface ImageCandidate {
  url: string;
  altText: string;
  contextText: string;
  componentHint: string;
  relevanceScore: number;
}

const COMPONENT_FOCUS_TERMS = [
  "accordion",
  "popover",
  "tooltip",
  "carousel",
  "tree view",
  "pagination",
  "tabs",
  "tabbed",
  "modal",
  "dialog",
  "dropdown",
  "menu",
  "sidebar",
  "navbar",
  "button",
  "input",
  "select",
  "checkbox",
  "radio",
  "breadcrumb",
  "form",
  "table",
  "list",
];

const DESIGN_SYSTEM_TERMS = [
  "design system",
  "product system",
  "figma",
  "storybook",
  "github",
  "open source",
  "framework",
  "platform",
  "data-tech",
  "data-platforms",
  "data-features",
  "data-component-count",
  "component-count",
  "tech-stack",
];

export async function extractUrlContent(input: {
  sourceUrl: string;
  maxImages: number;
}): Promise<ExtractedUrlContent> {
  const html = await fetchHtml(input.sourceUrl);
  const pageTitle = extractPageTitle(html, input.sourceUrl);
  const extractedText = extractMainText(html, pageTitle);
  const imageCandidates = extractImageCandidates(html, input.sourceUrl);
  const images = await downloadImageCandidates(
    imageCandidates,
    input.maxImages
  );

  return {
    sourceUrl: input.sourceUrl,
    pageTitle,
    extractedText,
    images,
  };
}

async function fetchHtml(sourceUrl: string): Promise<string> {
  const response = await fetchWithTimeout(sourceUrl, HTML_REQUEST_TIMEOUT_MS, {
    headers: {
      "User-Agent": "clearn-url-import/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`URL fetch failed with status ${response.status}`);
  }

  return response.text();
}

function extractPageTitle(html: string, sourceUrl: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "";
  const cleanedTitle = collapseWhitespace(stripTags(rawTitle)).trim();
  if (cleanedTitle.length > 0) {
    return cleanedTitle.slice(0, 160);
  }

  try {
    const url = new URL(sourceUrl);
    return url.hostname;
  } catch {
    return "Webseite";
  }
}

function extractMainText(html: string, pageTitle: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ");

  const withLineBreakHints = withoutNoise
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|article|section|li|h1|h2|h3|h4|h5|h6|tr|blockquote)>/gi, "\n");

  const text = decodeHtmlEntities(stripTags(withLineBreakHints));
  const lines = text
    .split("\n")
    .map((line) => collapseWhitespace(line).trim())
    .filter((line) => line.length > 0);

  const dedupedLines: string[] = [];
  for (const line of lines) {
    const previous = dedupedLines[dedupedLines.length - 1];
    if (previous !== line) {
      dedupedLines.push(line);
    }
  }

  const content = dedupedLines.join("\n");
  const contentWithTitle =
    content.toLowerCase().includes(pageTitle.toLowerCase()) || pageTitle.length === 0
      ? content
      : `${pageTitle}\n${content}`;

  return contentWithTitle.slice(0, MAX_TEXT_LENGTH);
}

function extractImageCandidates(html: string, sourceUrl: string): ImageCandidate[] {
  const imageTagRegex = /<img\b[^>]*>/gi;
  const uniqueByUrl = new Map<string, ImageCandidate>();
  let match: RegExpExecArray | null = imageTagRegex.exec(html);

  while (match) {
    const tag = match[0];
    const tagStart = match.index;
    const attrs = parseAttributes(tag);
    const srcRaw =
      attrs.src ??
      attrs["data-src"] ??
      attrs["data-lazy-src"] ??
      attrs["data-original"] ??
      attrs["data-url"];

    if (!srcRaw || srcRaw.startsWith("data:")) {
      match = imageTagRegex.exec(html);
      continue;
    }

    let absoluteUrl = "";
    try {
      absoluteUrl = new URL(srcRaw, sourceUrl).toString();
    } catch {
      match = imageTagRegex.exec(html);
      continue;
    }

    if (!isHttpUrl(absoluteUrl)) {
      match = imageTagRegex.exec(html);
      continue;
    }

    const altText = collapseWhitespace(decodeHtmlEntities(attrs.alt ?? "")).trim();
    const contextText = extractNearbyContext(html, tagStart);
    const componentHint = extractComponentHint(attrs, html, tagStart);
    const relevanceScore = scoreImageCandidate({
      url: absoluteUrl,
      altText,
      contextText,
      componentHint,
    });

    const existing = uniqueByUrl.get(absoluteUrl);
    if (!existing || relevanceScore > existing.relevanceScore) {
      uniqueByUrl.set(absoluteUrl, {
        url: absoluteUrl,
        altText,
        contextText,
        componentHint,
        relevanceScore,
      });
    }

    match = imageTagRegex.exec(html);
  }

  return [...uniqueByUrl.values()].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let attrMatch: RegExpExecArray | null = attrRegex.exec(tag);

  while (attrMatch) {
    const key = (attrMatch[1] ?? "").toLowerCase();
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    if (key) {
      attributes[key] = decodeHtmlEntities(value.trim());
    }
    attrMatch = attrRegex.exec(tag);
  }

  return attributes;
}

function extractNearbyContext(html: string, centerIndex: number): string {
  const windowSize = 350;
  const start = Math.max(0, centerIndex - windowSize);
  const end = Math.min(html.length, centerIndex + windowSize);
  const raw = html.slice(start, end);
  const withoutTags = stripTags(raw);
  const normalized = collapseWhitespace(decodeHtmlEntities(withoutTags)).trim();
  return normalized.slice(0, 220);
}

function extractComponentHint(
  attrs: Record<string, string>,
  html: string,
  centerIndex: number
): string {
  const preferredAttrOrder = [
    "data-component-name",
    "data-component",
    "data-name",
    "aria-label",
    "title",
    "alt",
  ];
  for (const key of preferredAttrOrder) {
    const normalized = normalizeHint(attrs[key] ?? "");
    if (normalized) return normalized;
  }

  const windowSize = 500;
  const start = Math.max(0, centerIndex - windowSize);
  const end = Math.min(html.length, centerIndex + windowSize);
  const raw = html.slice(start, end);
  const attributeMatches = raw.matchAll(
    /(?:data-component-name|data-component|data-name|aria-label|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  );
  let nearestHint = "";
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const match of attributeMatches) {
    const normalized = normalizeHint(match[1] ?? match[2] ?? "");
    if (!normalized) continue;
    const matchIndex = typeof match.index === "number" ? match.index : 0;
    const absoluteMatchIndex = start + matchIndex;
    const distance = Math.abs(centerIndex - absoluteMatchIndex);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHint = normalized;
    }
  }
  if (nearestHint) return nearestHint;

  return "";
}

function normalizeHint(rawValue: string): string {
  const value = collapseWhitespace(decodeHtmlEntities(rawValue))
    .trim()
    .replace(/[|]+/g, " ")
    .replace(/[.,;:!?]+$/g, "");
  if (value.length < 2 || value.length > 90) return "";
  if (value.includes("http://") || value.includes("https://")) return "";
  if (value.includes(".com")) return "";
  return value;
}

function scoreImageCandidate(candidate: {
  url: string;
  altText: string;
  contextText: string;
  componentHint: string;
}): number {
  const haystack = `${candidate.altText} ${candidate.contextText} ${candidate.componentHint}`.toLowerCase();
  const componentHintLower = candidate.componentHint.toLowerCase();
  let score = 0;

  if (candidate.altText.length > 0) score += 4;
  if (candidate.componentHint.length > 0) {
    score += isLikelyComponentHint(componentHintLower) ? 8 : 1;
    if (componentHintLower.includes("system")) score -= 6;
  }

  for (const term of COMPONENT_FOCUS_TERMS) {
    if (haystack.includes(term)) score += 3;
  }
  for (const term of DESIGN_SYSTEM_TERMS) {
    if (haystack.includes(term)) score -= 3;
  }

  const urlLower = candidate.url.toLowerCase();
  if (urlLower.includes("logo")) score -= 2;
  if (urlLower.includes("icon")) score -= 1;

  return score;
}

function isLikelyComponentHint(hintLower: string): boolean {
  if (!hintLower) return false;
  if (hintLower.includes("system")) return false;
  return COMPONENT_FOCUS_TERMS.some((term) => hintLower.includes(term));
}

async function downloadImageCandidates(
  candidates: ImageCandidate[],
  maxImages: number
): Promise<ExtractedUrlImage[]> {
  if (maxImages <= 0) return [];

  const images: ExtractedUrlImage[] = [];
  for (const candidate of candidates) {
    if (images.length >= maxImages) break;
    const downloaded = await downloadImage(candidate);
    if (downloaded) {
      images.push(downloaded);
    }
  }
  return images;
}

async function downloadImage(candidate: ImageCandidate): Promise<ExtractedUrlImage | null> {
  let response: Response;
  try {
    response = await fetchWithTimeout(candidate.url, IMAGE_REQUEST_TIMEOUT_MS, {
      headers: {
        "User-Agent": "clearn-url-import/1.0",
        Accept: "image/*",
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const mimeType = resolveSupportedMimeType(
    response.headers.get("content-type"),
    candidate.url
  );
  if (!mimeType) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return null;
  }

  return {
    url: candidate.url,
    altText: candidate.altText,
    contextText: candidate.contextText,
    componentHint: candidate.componentHint,
    mimeType,
    dataBase64: bytes.toString("base64"),
  };
}

function resolveSupportedMimeType(
  rawHeader: string | null,
  sourceUrl: string
): "image/jpeg" | "image/png" | "image/webp" | null {
  const normalized = rawHeader?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (SUPPORTED_MIME_TYPES.has(normalized)) {
    return normalized as "image/jpeg" | "image/png" | "image/webp";
  }

  const extension = sourceUrl.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return SUPPORTED_EXTENSIONS[extension] ?? null;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ");
}

function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
