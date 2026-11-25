import { requireUser } from "@/lib/supabase/server";
export async function GET() {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("export_backup");
  if (error)
    return new Response("Backup unavailable. Retry when connected.", {
      status: 503,
    });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="weekly-backup.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
