import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-6 text-sm">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">The page you opened does not exist.</p>
        <Link className="btn btn-primary mt-4" href="/">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
