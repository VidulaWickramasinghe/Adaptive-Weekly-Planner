import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(
  execFileSync(
    "node_modules/.bin/supabase",
    ["stack", "status", "--output-format", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const env = status.env;
if (!env || !["localhost", "127.0.0.1"].includes(new URL(env.API_URL).hostname))
  throw Error("Local runtime required");
const accounts = JSON.parse(readFileSync(".env.local-accounts", "utf8"));
const account = accounts.find((a) => a.email === "test-a@weekly.local");
if (!account) throw Error("Test account unavailable");
const admin = createClient(env.API_URL, env.SECRET_KEY, {
  auth: { persistSession: false },
});
const users = await admin.auth.admin.listUsers();
if (users.error) throw Error("Cannot list local test account");
const user = users.data.users.find((u) => u.email === account.email);
if (!user) throw Error("Local test account unavailable");
const password = randomBytes(24).toString("base64url");
const result = await admin.auth.admin.updateUserById(user.id, { password });
if (result.error) throw Error("Local rotation failed");
account.password = password;
writeFileSync(".env.local-accounts", JSON.stringify(accounts, null, 2) + "\n", {
  mode: 0o600,
});
await import("./setup-local.mjs");
console.log(
  "Local test password rotated. Owner and production accounts were not changed.",
);
