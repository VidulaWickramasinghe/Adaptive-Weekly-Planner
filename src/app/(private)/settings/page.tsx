import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { BackupForm } from "@/components/backup-form";
import { SettingsForm } from "@/components/forms";
export default async function Settings() {
  const { client, user } = await requireUser();
  const profile = await readProfile(client, user.id);
  return (
    <>
      <p className="eyebrow">MAKE IT YOURS</p>
      <h1>Planning preferences.</h1>
      <p className="lede">
        Give your week a starting point. You can change these anytime.
      </p>
      <section className="card settings-card">
        <h2>Your time, your rhythm</h2>
        <SettingsForm profile={profile} />
      </section>
      <section className="card">
        <h2>Backup and portable calendar</h2>
        <p>
          Download a private JSON backup, including archived records and
          revision history. Keep it somewhere secure. Restore is additive and
          account-specific: existing records and preferences are never
          overwritten.
        </p>
        <p>
          <a href="/api/backup">Download JSON backup</a>
        </p>
        <p>
          <a href="/api/calendar">Export this week as calendar (.ics)</a>
        </p>
        <BackupForm />
      </section>
      <section className="card">
        <h2>Install Weekly</h2>
        <p>
          On a supported desktop browser, use its install-app command. On
          iPhone, open the hosted HTTPS app in Safari, choose Share, then Add to
          Home Screen.
        </p>
        <p>
          Weekly requires a connection for private data and saves. No offline
          writes or background notifications are enabled. Localhost is usable on
          this Mac; a physical iPhone needs a reachable HTTPS deployment.
        </p>
      </section>
    </>
  );
}
