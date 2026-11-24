"use client";
import Link from "next/link";

/** Shown when a page cannot load, for example before the database is connected or before first-time setup. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-6 text-sm">
        <h1 className="text-lg font-semibold">This page could not load</h1>
        <p className="mt-2 text-muted">
          Try again in a moment. If the competition has not been set up yet, an organiser should open the setup page first.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn" href="/setup">
            Setup page
          </Link>
          <Link className="btn" href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
