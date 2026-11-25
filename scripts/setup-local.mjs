import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const cli = "node_modules/.bin/supabase";
const raw = execFileSync(cli, ["stack", "status", "--output-format", "json"], {
  encoding: "utf8",
});
const status = JSON.parse(raw);
const env = status.env;
if (
  !env ||
  !["localhost", "127.0.0.1"].includes(new URL(env.API_URL).hostname)
) {
  throw new Error(
    "This setup script only provisions a local Supabase instance.",
  );
}
const config =
  "NEXT_PUBLIC_SUPABASE_URL=" +
  env.API_URL +
  "\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" +
  env.PUBLISHABLE_KEY +
  "\n";
if (
  existsSync(".env.local") &&
  !readFileSync(".env.local", "utf8").includes(env.API_URL)
) {
  throw new Error(
    "Existing .env.local points elsewhere. Preserve it and review configuration first.",
  );
}
writeFileSync(".env.local", config, { mode: 0o600 });
const admin = createClient(env.API_URL, env.SECRET_KEY, {
  auth: { persistSession: false },
});
const accessPath = ".env.local-accounts";
let accounts;
if (existsSync(accessPath)) {
  accounts = JSON.parse(readFileSync(accessPath, "utf8"));
} else {
  accounts = ["owner", "test-a", "test-b"].map((name) => ({
    email: name + "@weekly.local",
    password: randomBytes(24).toString("base64url"),
  }));
  writeFileSync(accessPath, JSON.stringify(accounts, null, 2) + "\n", {
    mode: 0o600,
  });
}
const listed = await admin.auth.admin.listUsers();
if (listed.error) throw listed.error;
for (const account of accounts) {
  if (!listed.data.users.some((user) => user.email === account.email)) {
    const { error } = await admin.auth.admin.createUser({
      ...account,
      email_confirm: true,
    });
    if (error) throw error;
  }
}
writeFileSync(
  ".env.test",
  config +
    accounts
      .slice(1)
      .map((account, index) => {
        const letter = index === 0 ? "A" : "B";
        return (
          "TEST_USER_" +
          letter +
          "_EMAIL=" +
          account.email +
          "\nTEST_USER_" +
          letter +
          "_PASSWORD=" +
          account.password
        );
      })
      .join("\n") +
    "\n",
  { mode: 0o600 },
);
console.log(
  "Local connection configured. Owner login is stored privately in .env.local-accounts. Two test accounts are ready.",
);
