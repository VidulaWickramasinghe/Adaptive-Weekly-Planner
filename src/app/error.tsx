"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>We couldn’t finish that request.</h1>
      <p>
        Check your connection and retry. If a save was interrupted, reload the
        latest records before submitting it again.
      </p>
      <button onClick={reset}>Try again</button>
      <p>
        <Link href="/">Return to overview</Link>
      </p>
    </main>
  );
}
