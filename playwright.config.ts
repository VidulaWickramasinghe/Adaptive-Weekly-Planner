import { existsSync } from "node:fs";
for (const file of [".env.local", ".env.test"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
import { defineConfig, devices } from "@playwright/test";
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw Error("Browser tests are restricted to local Supabase.");
const production = process.env.PLAYWRIGHT_PRODUCTION === "1";
const url = production ? "http://127.0.0.1:3100" : "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { baseURL: url, trace: "off" },
  webServer: {
    command: production
      ? "pnpm start --hostname 127.0.0.1 --port 3100"
      : "pnpm dev --hostname 127.0.0.1",
    url,
    reuseExistingServer: !production && !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
  ],
});
