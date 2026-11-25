export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/forms";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside>
        <Link href="/" className="brand">
          <span className="brand-mark">w</span>weekly
          <span className="brand-dot">.</span>
        </Link>
        <p className="nav-label">YOUR SPACE</p>
        <nav aria-label="Main navigation">
          <Link href="/">
            Overview <span>↗</span>
          </Link>
          <Link href="/planner">
            Planner <span>↗</span>
          </Link>
          <Link href="/proposal">
            Plan week <span>↗</span>
          </Link>
          <Link href="/projects">
            Study & publication <span>↗</span>
          </Link>
          <Link href="/progress">
            Progress <span>↗</span>
          </Link>
          <Link href="/settings">
            Settings <span>↗</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <p>
            A little structure.
            <br />
            Room for real life.
          </p>
          <SignOutButton />
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}
