// Disposable local PostgreSQL only. No .env, deployed Supabase, or production data.
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "cloudlearn-occlusion-"));
const data = join(root, "data"), socket = join(root, "socket");
mkdirSync(socket);
const server = createServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
let started = false;
try {
  run("initdb", ["-D", data, "--username=occlusion_test", "--auth=trust", "--no-locale"]);
  run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${socket}`, "-w", "start"]);
  started = true;
  const database = `cloudlearn_occlusion_test_${Date.now()}`;
  run("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "occlusion_test", database]);
  const connection = `postgresql://occlusion_test@127.0.0.1:${port}/${database}`;
  const localEnv = { ...process.env, DATABASE_URL: connection, CLOUDLEARN_OCCLUSION_TEST_DATABASE_URL: connection };
  const testArgs = ["--filter", "@clearn/api", "exec", "vitest", "run", "src/tests/occlusionDb.integration.test.ts"];
  run("pnpm", testArgs, { env: localEnv });
  // Also exercise the automatic CI path, which creates its own database.
  const ciEnv = { ...localEnv };
  delete ciEnv.CLOUDLEARN_OCCLUSION_TEST_DATABASE_URL;
  run("pnpm", testArgs, { env: ciEnv });
  run("pnpm", ["run", "restore:smoke"], { env: ciEnv });
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Local PostgreSQL evidence directory: ${root}`);
}
