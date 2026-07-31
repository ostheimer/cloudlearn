import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { listPushDevices } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const USER_ID = "11111111-1111-4111-8111-111111111111";

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeDbMock(rows: unknown[]) {
  const calls: RecordedCall[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.order = (...args: unknown[]) => {
    calls.push({ method: "order", args });
    return Promise.resolve({ data: rows, error: null });
  };
  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    return builder;
  });
  return { db: { from } as never, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPushDevices (#614)", () => {
  it("gibt Plattform und Zeitpunkte zurück — aber NIE den Token", async () => {
    const { db, calls } = makeDbMock([
      {
        platform: "ios",
        created_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-29T18:00:00.000Z",
        token: "ExponentPushToken[geheim]",
      },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const devices = await listPushDevices(USER_ID);

    expect(devices).toEqual([
      {
        platform: "ios",
        firstSeenAt: "2026-07-01T10:00:00.000Z",
        lastSeenAt: "2026-07-29T18:00:00.000Z",
      },
    ]);
    // Der Token ist ein Zustellungs-Geheimnis: wer ihn hat, kann diesem Gerät
    // Benachrichtigungen schicken. Für die Anzeige ist er wertlos — er darf
    // die Datenbank gar nicht erst verlassen.
    expect(JSON.stringify(devices)).not.toContain("ExponentPushToken");
    expect(calls.find((c) => c.method === "select")?.args[0]).toBe(
      "platform, created_at, updated_at"
    );
  });

  it("fragt nur die eigenen Geräte ab, neueste zuerst", async () => {
    const { db, calls } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    await listPushDevices(USER_ID);

    expect(calls.find((c) => c.method === "from")?.args).toEqual(["push_tokens"]);
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["user_id", USER_ID]);
    expect(calls.find((c) => c.method === "order")?.args).toEqual([
      "updated_at",
      { ascending: false },
    ]);
  });

  it("kommt ohne Plattform-Angabe und ohne updated_at zurecht", async () => {
    const { db } = makeDbMock([
      { platform: null, created_at: "2026-07-01T10:00:00.000Z", updated_at: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    expect(await listPushDevices(USER_ID)).toEqual([
      {
        platform: "unbekannt",
        firstSeenAt: "2026-07-01T10:00:00.000Z",
        // Ohne updated_at gilt der Anlage-Zeitpunkt — besser als „nie aktiv".
        lastSeenAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  it("gibt für ein Konto ohne Geräte eine leere Liste", async () => {
    const { db } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);
    expect(await listPushDevices(USER_ID)).toEqual([]);
  });
});
