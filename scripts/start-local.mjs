import { execFileSync } from "node:child_process";
const cli = "node_modules/.bin/supabase";
console.log(
  "Starting local Supabase. The first run downloads native service binaries.",
);
try {
  execFileSync(
    cli,
    [
      "stack",
      "start",
      "--runtime",
      "native",
      "--exclude",
      "realtime,storage,functions,studio,mail,analytics,pooler",
      "--eager",
    ],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 },
  );
  execFileSync(cli, ["migration", "up"], { stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error(
    "Local startup failed. Run pnpm exec supabase stack start to inspect the service error. Its status output includes local credentials.",
  );
  process.exit(1);
}
await import("./setup-local.mjs");
console.log(
  "Run pnpm dev and open http://localhost:3000. Stop database services with pnpm local:stop.",
);
