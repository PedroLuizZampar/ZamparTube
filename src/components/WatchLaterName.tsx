"use client";

import { createContext, useContext } from "react";

const WatchLaterNameContext = createContext("Assistir depois");

/** Set once in the app layout from the database, so every "save for later" label uses the user's name for it. */
export function WatchLaterNameProvider({ name, children }: { name: string; children: React.ReactNode }) {
  return <WatchLaterNameContext.Provider value={name}>{children}</WatchLaterNameContext.Provider>;
}

export function useWatchLaterName(): string {
  return useContext(WatchLaterNameContext);
}
