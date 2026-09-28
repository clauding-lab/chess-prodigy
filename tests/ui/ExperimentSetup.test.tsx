import { expect, it } from "vitest";
import { setupFromDraft } from "../../src/ui/Modals";
const draft = {
  color: "w" as const,
  level: "club" as const,
  time: "none" as const,
  opponentId: "tal" as const,
};
it("selects experimental games only with both flags and preserves explicit version1 rematches", () => {
  expect(setupFromDraft(draft, true, false).opponent?.version).toBe(1);
  expect(setupFromDraft(draft, true, true).opponent).toMatchObject({
    id: "tal",
    version: 2,
    engine: "tal-coherent-v1",
  });
  expect(setupFromDraft({ ...draft, opponentVersion: 1 }, true, true).opponent?.version).toBe(1);
  expect(() => setupFromDraft({ ...draft, opponentVersion: 2 }, true, false)).toThrow();
  expect(() => setupFromDraft(draft, false, true)).toThrow();
  expect(setupFromDraft({ ...draft, opponentId: "fischer" }, true, true).opponent?.engine).toBe(
    "fischer-coherent-v1",
  );
  expect(setupFromDraft({ ...draft, opponentId: "spassky" }, true, true).opponent?.version).toBe(1);
});
it("keeps experimental rematches behind the experiment flag while preserving old rematches", async () => {
  const { canRematch } = await import("../../src/ui/RecordedGames");
  const { experimentalRosterConfig, rosterConfig } = await import("../../src/engine/opponents");
  expect(canRematch({ opponent: experimentalRosterConfig("tal", 1) }, true, false)).toBe(false);
  expect(canRematch({ opponent: experimentalRosterConfig("tal", 1) }, true, true)).toBe(true);
  expect(canRematch({ opponent: rosterConfig("tal", 1) }, true, false)).toBe(true);
});
