export const dynamic = "force-dynamic";
import { SignInForm } from "@/components/forms";
import { supabaseConfig } from "@/lib/supabase/config";
export default function SignIn() {
  const configured = supabaseConfig();
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">w</span>weekly.
        </div>
        <div>
          <p className="eyebrow">SPACE FOR THE WEEK AHEAD</p>
          <h1>
            A little structure.
            <br />
            <em>More possibility.</em>
          </h1>
          <p>Your commitments, your priorities, your pace.</p>
        </div>
        <span>PERSONAL ADAPTIVE PLANNER</span>
      </section>
      <section className="auth-panel">
        {configured ? (
          <>
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Make yourself at home.</h2>
            <p>Sign in to your private planning space.</p>
            <SignInForm />
            <p className="hint">
              Use the account provided by your planner administrator.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">GETTING STARTED</p>
            <h2>Connect your planning space.</h2>
            <p>
              The application needs its Supabase connection before you can sign
              in.
            </p>
            <ol className="setup-list">
              <li>
                Configure the project URL and publishable key in{" "}
                <code>.env.local</code> using <code>.env.example</code>.
              </li>
              <li>
                Apply the profile migration and create your private account.
              </li>
              <li>Restart the application to sign in.</li>
            </ol>
            <p className="hint">The README includes the setup commands.</p>
          </>
        )}
      </section>
    </main>
  );
}
