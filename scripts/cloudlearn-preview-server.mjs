#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../apps/mobile/dist");
const indexPath = path.join(distDir, "index.html");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "4173");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedPath = path.resolve(distDir, `.${pathname}`);
    const isAssetRequest = requestedPath.startsWith(distDir) && pathname !== "/";
    const filePath = isAssetRequest ? requestedPath : indexPath;
    const body = await readFile(filePath);
    const mimeType = mimeTypes[path.extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    try {
      const body = await readFile(indexPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("cloudlearn preview export not found");
    }
  }
});

server.listen(port, host, () => {
  console.log(`[cloudlearn-preview] serving ${distDir} on http://${host}:${port}`);
});
