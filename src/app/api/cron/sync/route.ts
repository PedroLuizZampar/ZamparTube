import { checkPassword } from "@/lib/auth/session";
import { createSyncDeps, runSync } from "@/lib/sync/run-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called once a day by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !checkPassword(header, `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync(createSyncDeps());
  return Response.json(result);
}
