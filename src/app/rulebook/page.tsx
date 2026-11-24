import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { dateTime } from "@/lib/format";
import { publishedRulebook } from "@/server/views";

export const metadata = { title: "Rulebook" };
export const dynamic = "force-dynamic";

export default async function PublicRulebook() {
  const rb = await publishedRulebook().catch(() => null);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-accent">Back</Link>
      {rb ? (
        <>
          <p className="mt-4 text-xs text-muted">
            Version {rb.version}, published {dateTime(rb.createdAt)}
          </p>
          <div className="card mt-3 p-6">
            <Markdown source={rb.content} />
          </div>
        </>
      ) : (
        <p className="mt-6 text-muted">The rulebook has not been published yet.</p>
      )}
    </main>
  );
}
