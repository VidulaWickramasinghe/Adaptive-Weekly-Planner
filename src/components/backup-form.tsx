"use client";
import { useActionState } from "react";
import { restoreBackup } from "@/app/backup-actions";
export function BackupForm() {
  const [state, action, pending] = useActionState(restoreBackup, {});
  return (
    <form action={action}>
      <label>
        Backup JSON file
        <input
          type="file"
          name="backup"
          accept="application/json,.json"
          required
        />
      </label>
      <label>
        <input name="confirm" type="checkbox" required />
        Restore missing records only; preserve existing records and preferences.
      </label>
      <button disabled={pending}>Restore missing records</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
