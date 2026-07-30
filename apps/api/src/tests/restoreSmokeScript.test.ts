/**
 * Die Restore-Probe legt Datenbanken an und löscht sie wieder. Der Schutz, der
 * verhindert, dass sie das jemals gegen eine echte Supabase-Datenbank tut, darf
 * niemals still kaputtgehen — deshalb steht er hier unter Test (#86).
 */

import { describe, expect, it } from "vitest";
import { assertThrowawayTarget } from "../../../../scripts/restore-smoke";

describe("scripts/restore-smoke: Schutz vor Produktion", () => {
  it.each([
    "postgres://user:pw@db.yektpwhycxusblnueplm.supabase.co:5432/postgres",
    "postgresql://user:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ])("weist eine Supabase-Adresse ab: %s", (url) => {
    expect(() => assertThrowawayTarget(url)).toThrow(/Wegwerf-Postgres/);
  });

  it.each([
    "postgres://postgres:postgres@localhost:5432/clearn_test",
    "postgres://postgres:postgres@127.0.0.1:55432/clearn_test",
  ])("laesst einen Wegwerf-Server zu: %s", (url) => {
    expect(() => assertThrowawayTarget(url)).not.toThrow();
  });
});
