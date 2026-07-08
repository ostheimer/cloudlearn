import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { envSchema } from "../lib/env";

const rootEnvExample = readFileSync(
  fileURLToPath(new URL("../../../../.env.example", import.meta.url)),
  "utf8",
);

describe("root .env.example stays in sync with env.ts", () => {
  for (const key of Object.keys(envSchema.shape)) {
    it(`documents ${key}`, () => {
      expect(rootEnvExample).toMatch(new RegExp(`^${key}=`, "m"));
    });
  }
});
