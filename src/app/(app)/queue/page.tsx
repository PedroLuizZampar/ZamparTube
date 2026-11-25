import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import { QueuePanel } from "@/components/QueuePanel";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { listQueue, queueCursor, queueResumeId } from "@/lib/queries/queue";

export const metadata: Metadata = { title: "Fila · ZamparTube" };

export default async function QueuePage() {
  const userId = await requireUserId();
  const db = getDb();
  const [items, cursor, resumeId] = await Promise.all([
    listQueue(db, userId),
    queueCursor(db, userId),
    queueResumeId(db, userId),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Fila</h1>
        {resumeId && (
          <Link
            href={`/watch/${resumeId}`}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Play className="h-4 w-4 fill-current" /> {cursor ? "Continuar de onde parou" : "Reproduzir fila"}
          </Link>
        )}
      </div>
      {/* The page button already resumes; the panel only marks where it stopped. */}
      <QueuePanel items={items} cursorId={cursor} hideResume mode={{ kind: "queue" }} />
    </div>
  );
}
