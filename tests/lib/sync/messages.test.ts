import { describe, expect, it } from "vitest";
import { syncMessage } from "@/lib/sync/messages";

describe("syncMessage", () => {
  it("done", () => expect(syncMessage({ synced: 3, remaining: 0, stoppedReason: "done" })).toBe("Tudo atualizado"));
  it("budget", () =>
    expect(syncMessage({ synced: 4, remaining: 2, stoppedReason: "budget" })).toBe(
      "Atualizados 4 canais; o resto continua na próxima atualização",
    ));
  it("budget singular", () =>
    expect(syncMessage({ synced: 1, remaining: 2, stoppedReason: "budget" })).toBe(
      "Atualizado 1 canal; o resto continua na próxima atualização",
    ));
  it("quota", () =>
    expect(syncMessage({ synced: 0, remaining: 5, stoppedReason: "quota" })).toBe(
      "Cota diária da API esgotada. Tente de novo amanhã.",
    ));
});
