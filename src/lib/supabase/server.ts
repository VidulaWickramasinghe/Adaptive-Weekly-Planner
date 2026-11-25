import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfig } from "./config";
export async function serverClient() {
  const config = supabaseConfig();
  if (!config) redirect("/sign-in");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server component cookies are refreshed by proxy. */
        }
      },
    },
  });
}
export async function requireUser() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/sign-in");
  return { client, user: data.user };
}
