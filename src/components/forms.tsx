"use client";
import { useActionState, useState } from "react";
import { signIn, signOut, saveSettings, type FormState } from "@/app/actions";
import type { Profile } from "@/domain/settings";
function Feedback({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      <p role="alert" className="error">
        {error}
      </p>
      <p role="status" className="success">
        {success}
      </p>
    </>
  );
}
export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action}>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Feedback {...state} />
      <button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
export function SignOutButton() {
  const [state, action, pending] = useActionState(signOut, {});
  return (
    <form action={action}>
      <button className="quiet" disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      <Feedback {...state} />
    </form>
  );
}
async function submitSettings(
  state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    return await saveSettings(state, form);
  } catch {
    return {
      error: "Connection failed. Your draft is retained. Please try again.",
      version: state.version,
    };
  }
}
export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(submitSettings, {});
  const [timezone, setTimezone] = useState(profile.timezone);
  const [capacity, setCapacity] = useState(
    String(profile.preferred_daily_capacity),
  );
  return (
    <form action={action}>
      <input
        type="hidden"
        name="version"
        value={state.version ?? profile.version}
      />
      <label htmlFor="timezone">Time zone</label>
      <input
        id="timezone"
        name="timezone"
        value={timezone}
        onChange={(event) => setTimezone(event.target.value)}
        list="zones"
        required
        aria-describedby="zone-help"
      />
      <datalist id="zones">
        {[
          "Australia/Melbourne",
          "Australia/Sydney",
          "Australia/Perth",
          "Europe/London",
          "America/New_York",
          "UTC",
        ].map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <p id="zone-help" className="hint">
        Used for your local dates and weekly boundaries.
      </p>
      <label htmlFor="capacity">Preferred daily capacity · minutes</label>
      <input
        id="capacity"
        name="preferred_daily_capacity"
        type="number"
        min="0"
        max="1440"
        step="1"
        value={capacity}
        onChange={(event) => setCapacity(event.target.value)}
        required
      />
      <p className="hint">
        Your preferred amount of flexible activity each day.
      </p>
      <div className="setting-line">
        <span>Planning week</span>
        <strong>Sunday – Saturday</strong>
      </div>
      <Feedback {...state} />
      <button disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
