import { afterEach, describe, expect, it, vi } from "vitest";
import { extractUrlContent } from "@/lib/urlContentExtractor";

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("urlContentExtractor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts page text and resolves relative image URLs", async () => {
    const sourceUrl = "https://example.com/docs/page";
    const imageUrl = "https://example.com/assets/gallery.png";
    const html = `
      <html>
        <head><title>Component Gallery</title></head>
        <body>
          <main>
            <h1>Component Gallery</h1>
            <p>Buttons and cards with labels.</p>
            <img src="/assets/gallery.png" alt="Component Übersicht" />
            <img src="/assets/gallery.png" alt="duplicate" />
          </main>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = getUrl(input);
      if (url === sourceUrl) {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === imageUrl) {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const extracted = await extractUrlContent({ sourceUrl, maxImages: 3 });

    expect(extracted.pageTitle).toBe("Component Gallery");
    expect(extracted.extractedText).toContain("Buttons and cards with labels.");
    expect(extracted.images).toHaveLength(1);
    expect(extracted.images[0]?.url).toBe(imageUrl);
    expect(extracted.images[0]?.mimeType).toBe("image/png");
    expect(extracted.images[0]?.altText).toBe("Component Übersicht");
    expect(extracted.images[0]?.componentHint).toBe("Component Übersicht");
    expect(extracted.images[0]?.dataBase64.length).toBeGreaterThan(0);
  });

  it("respects maxImages and skips unsupported image content types", async () => {
    const sourceUrl = "https://example.com/with-many-images";
    const html = `
      <html>
        <head><title>Many Images</title></head>
        <body>
          <img src="https://cdn.example.com/a.svg" alt="A" />
          <img src="https://cdn.example.com/b.jpg" alt="B" />
          <img src="https://cdn.example.com/c.png" alt="C" />
        </body>
      </html>
    `;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = getUrl(input);
      if (url === sourceUrl) {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url.endsWith("a.svg")) {
        return new Response("<svg />", {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        });
      }
      if (url.endsWith("b.jpg")) {
        return new Response(new Uint8Array([1, 1, 1]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.endsWith("c.png")) {
        return new Response(new Uint8Array([2, 2, 2]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const extracted = await extractUrlContent({ sourceUrl, maxImages: 1 });
    expect(extracted.images).toHaveLength(1);
    expect(extracted.images[0]?.mimeType).toBe("image/jpeg");
  });

  it("prefers component-focused screenshots over design-system branding images", async () => {
    const sourceUrl = "https://example.com/gallery";
    const html = `
      <html>
        <head><title>Gallery</title></head>
        <body>
          <section data-name="Acme Design System" data-platforms="Storybook,Figma">
            <img src="https://cdn.example.com/logo.webp" alt="" />
          </section>
          <section data-component-name="Accordion" data-description="Expandable content component">
            <img src="https://cdn.example.com/accordion.png" alt="" />
          </section>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = getUrl(input);
      if (url === sourceUrl) {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url.endsWith("logo.webp")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/webp" },
        });
      }
      if (url.endsWith("accordion.png")) {
        return new Response(new Uint8Array([4, 5, 6]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("not found", { status: 404 });
    });

    const extracted = await extractUrlContent({ sourceUrl, maxImages: 1 });

    expect(extracted.images).toHaveLength(1);
    expect(extracted.images[0]?.url).toBe("https://cdn.example.com/accordion.png");
    expect(extracted.images[0]?.componentHint).toBe("Accordion");
  });

  it("throws on non-successful HTML response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("forbidden", { status: 403 })
    );

    await expect(
      extractUrlContent({ sourceUrl: "https://example.com/forbidden", maxImages: 2 })
    ).rejects.toThrow("URL fetch failed");
  });
});
