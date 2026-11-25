import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { PlayerHost } from "@/components/player/NowPlaying";
import { WatchLaterNameProvider } from "@/components/WatchLaterName";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { readWatchLaterName } from "@/lib/queries/playlists";
import { queueCount } from "@/lib/queries/queue";
import { getProfile } from "@/lib/queries/users";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";

// Every page reads the database; nothing here can be prerendered at build time.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // error.tsx cannot catch a failure in this layout: never let the label lookup take every page down.
  const userId = await requireUserId();
  const db = getDb();
  const [watchLaterName, queued, profile] = await Promise.all([
    readWatchLaterName(db, userId).catch(() => "Assistir depois"),
    queueCount(db, userId).catch(() => 0),
    getProfile(db, userId).catch(() => null),
  ]);
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <WatchLaterNameProvider name={watchLaterName}>
      {/* The player outlives every page: big on a watch page, mini elsewhere. */}
      <PlayerHost>
        <AppShell queueCount={queued} initialCollapsed={sidebarCollapsed} account={{ username: profile?.username ?? "Conta", imageSrc: profile?.imageSrc ?? "" }}
        >
          {children}
        </AppShell>
      </PlayerHost>
    </WatchLaterNameProvider>
  );
}
