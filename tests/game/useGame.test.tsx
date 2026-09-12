import React, { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { legalMoves } from "../../src/engine/board";
import { useGame } from "../../src/game/useGame";
import type { RequestInput, EngineResult } from "../../src/worker/protocol";
import { freshSession } from "../../src/game/state";
const fake = vi.hoisted(() => ({
  jobs: [] as Array<{
    input: RequestInput;
    resolve: (r: EngineResult) => void;
    reject: (e: Error) => void;
  }>,
  sound: vi.fn(),
}));
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    request(input: RequestInput) {
      return new Promise<EngineResult>((resolve, reject) =>
        fake.jobs.push({ input, resolve, reject }),
      );
    }
    cancel() {}
    dispose() {}
  },
}));
vi.mock("../../src/game/sound", () => ({ playSound: fake.sound }));
beforeEach(() => {
  localStorage.clear();
  fake.jobs.length = 0;
  fake.sound.mockClear();
});
afterEach(() => vi.useRealTimers());
it("blocks new beta games when the capability flag is off without abandoning Classic", async () => {
  const { morphyConfig } = await import("../../src/engine/opponents");
  vi.stubEnv("VITE_PERSONALITY_BETA", "false");
  const { result } = renderHook(() => useGame(true));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const before = result.current.game;
  let accepted = true;
  act(() => {
    accepted = result.current.startGame({
      playerColor: "w",
      level: "club",
      time: "none",
      opponent: morphyConfig(1),
    });
  });
  expect(accepted).toBe(false);
  expect(result.current.game).toBe(before);
  expect(result.current.rating.games).toBe(0);
  vi.unstubAllEnvs();
});
it("does not schedule work, settle clocks or overwrite a saved unavailable opponent", async () => {
  vi.useFakeTimers();
  const { reduceSession } = await import("../../src/game/state");
  let s = freshSession(0, "unavailable");
  s = reduceSession(s, {
    type: "new",
    id: "timed",
    now: 0,
    setup: { playerColor: "w", level: "club", time: "5+0" },
  });
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s.game.opponent.version = 99;
  const raw = JSON.stringify(s);
  localStorage.setItem("chess-prodigy-state-v3", raw);
  const { result } = renderHook(() => useGame(false), { wrapper: StrictMode });
  act(() => {
    result.current.askHint();
    result.current.review();
    result.current.undo();
    result.current.resign();
    result.current.resetRating();
    result.current.startGame(s.game.setup);
  });
  await act(async () => vi.advanceTimersByTimeAsync(400000));
  expect(fake.jobs).toEqual([]);
  expect(result.current.game).toEqual(s.game);
  expect(localStorage.getItem("chess-prodigy-state-v3")).toBe(raw);
});
it("holds a ready engine reply for a second while the engine clock keeps running", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useGame(false), { wrapper: StrictMode });
  act(() => result.current.startGame({ playerColor: "w", level: "club", time: "5+0" }));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const job = fake.jobs.filter((j) => j.input.type === "ai").at(-1)!;
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 0, book: true }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(result.current.game.hist).toHaveLength(1);
  expect(result.current.thinking).toBe(true);
  expect(result.current.game.clocks!.b).toBeLessThan(300000);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(result.current.game.hist).toHaveLength(2);
});

it.each(["undo", "resign", "new"])("cancels a ready but delayed reply on %s", async (action) => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useGame(false));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const job = fake.jobs.filter((j) => j.input.type === "ai").at(-1)!;
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 0, book: false }),
  );
  expect(result.current.game.hist).toHaveLength(1);
  act(() => {
    if (action === "new")
      result.current.startGame({ playerColor: "w", level: "club", time: "none" });
    else result.current[action as "undo" | "resign"]();
  });
  const length = result.current.game.hist.length;
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(result.current.game.hist).toHaveLength(length);
});
it("does not add a second wait when the engine calculation already took longer", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useGame(false));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const job = fake.jobs.filter((j) => j.input.type === "ai").at(-1)!;
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 0, book: false }),
  );
  expect(result.current.game.hist).toHaveLength(2);
});
it("plays via background calculation, saves transitions and ignores a replaced game response", async () => {
  const { result } = renderHook(() => useGame(false));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  await waitFor(() => expect(fake.jobs.some((j) => j.input.type === "ai")).toBe(true));
  const job = fake.jobs.find((j) => j.input.type === "ai")!;
  const old = result.current.game.id;
  act(() => result.current.startGame({ playerColor: "w", level: "club", time: "none" }));
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 12, book: false }),
  );
  expect(result.current.game.id).not.toBe(old);
  expect(result.current.game.hist).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem("chess-prodigy-state-v3")!).game.id).toBe(
    result.current.game.id,
  );
});
it("does not write saves on ordinary clock display ticks", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useGame(true));
  act(() => result.current.startGame({ playerColor: "w", level: "club", time: "5+0" }));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const save = vi.spyOn(Storage.prototype, "setItem");
  save.mockClear();
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.game.clocks!.b).toBeLessThan(300000);
  expect(save).not.toHaveBeenCalled();
  save.mockRestore();
});
it("invalidates hint work on undo and keeps hints unrated after reload", async () => {
  const { result, unmount } = renderHook(() => useGame(true));
  act(() => {
    result.current.move(legalMoves(result.current.game.st)[0]);
  });
  act(() => result.current.undo());
  act(() => result.current.askHint());
  const job = fake.jobs.at(-1)!;
  expect(result.current.game.rated).toBe(false);
  act(() => result.current.startGame({ playerColor: "w", level: "club", time: "none" }));
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 0, depth: 1 }),
  );
  expect(result.current.hint).toBe(null);
  act(() => result.current.askHint());
  unmount();
  const restored = renderHook(() => useGame(true));
  expect(restored.result.current.game.hintUsed).toBe(true);
  expect(restored.result.current.game.rated).toBe(false);
});
it("plays first-move sound once in StrictMode, with no sounds for preferences or undo", () => {
  const { result } = renderHook(() => useGame(true), { wrapper: StrictMode });
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  expect(fake.sound).toHaveBeenCalledTimes(1);
  act(() => result.current.setPreferences({ sound: false }));
  act(() => result.current.undo());
  expect(fake.sound).toHaveBeenCalledTimes(1);
});
it("does not overwrite corrupt data until explicit recovery", () => {
  localStorage.setItem("chess-prodigy-state-v3", "bad");
  const { result } = renderHook(() => useGame(true));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  expect(localStorage.getItem("chess-prodigy-state-v3")).toBe("bad");
  act(() => result.current.enableSaving());
  expect(result.current.storageStatus).toBe("saved");
  expect(JSON.parse(localStorage.getItem("chess-prodigy-state-v3")!).game.hist).toHaveLength(1);
});

it("sends legal opening continuations to the engine, rather than the moves already played", async () => {
  const { result } = renderHook(() => useGame(false));
  act(() =>
    result.current.move(
      legalMoves(result.current.game.st).find((m) => m.from === 52 && m.to === 36)!,
    ),
  );
  await waitFor(() => expect(fake.jobs.some((j) => j.input.type === "ai")).toBe(true));
  const job = fake.jobs.find((j) => j.input.type === "ai")!;
  if (job.input.type !== "ai") throw new Error("Expected AI request");
  expect(job.input.bookSans).toContain("e5");
  expect(job.input.bookSans).not.toContain("e4");
});

it("persists an abandoned rated result before replacing it with a new game", () => {
  const saved: Array<{ id: string; reason: string | null; terminal: boolean }> = [];
  const adapter = {
    load: () => ({
      session: freshSession(Date.now(), "old"),
      status: "saved" as const,
      hasSavedGame: false,
    }),
    save: (session: ReturnType<typeof freshSession>, options?: { terminal?: boolean }) => {
      saved.push({
        id: session.game.id,
        reason: session.game.over?.reason ?? null,
        terminal: !!options?.terminal,
      });
      return true;
    },
  };
  const { result } = renderHook(() => useGame(true, adapter));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  saved.length = 0;
  act(() => result.current.startGame({ playerColor: "w", level: "club", time: "none" }));

  expect(saved).toEqual([
    { id: "old", reason: "Abandoned", terminal: true },
    { id: result.current.game.id, reason: null, terminal: false },
  ]);
});

it("does not replace the only terminal game when history or pending-save storage fails", () => {
  const saved: string[] = [];
  const adapter = {
    load: () => ({
      session: freshSession(Date.now(), "protected"),
      status: "saved" as const,
      hasSavedGame: false,
    }),
    save: (s: ReturnType<typeof freshSession>, options?: { terminal?: boolean }) => {
      saved.push(s.game.id);
      return !options?.terminal;
    },
  };
  const { result } = renderHook(() => useGame(true, adapter));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  let accepted = true;
  act(() => {
    accepted = result.current.startGame({ playerColor: "w", level: "club", time: "none" });
  });
  expect(accepted).toBe(false);
  expect(result.current.game.id).toBe("protected");
  expect(saved.every((id) => id === "protected")).toBe(true);
  expect(result.current.storageStatus).toBe("unavailable");
});

it("does not cache a biased opponent score when its move is applied", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useGame(false));
  act(() => result.current.move(legalMoves(result.current.game.st)[0]));
  const job = fake.jobs.filter((j) => j.input.type === "ai").at(-1)!;
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 8888, book: false }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(result.current.game.hist).toHaveLength(2);
  expect(result.current.game.evals[1]).toBeUndefined();
  expect(fake.jobs.at(-1)!.input.type).toBe("analyse");
});

async function completedReviewFixture() {
  const { reduceSession } = await import("../../src/game/state");
  const { reviewPosition, reviewHistory } = await import("../../src/engine/reviewer");
  let s = freshSession(Date.now(), "reviewed-game");
  s = reduceSession(s, {
    type: "move",
    move: legalMoves(s.game.st)[0],
    book: false,
    now: Date.now(),
  });
  s = reduceSession(s, { type: "resign", now: Date.now() });
  for (let ply = 0; ply <= s.game.hist.length; ply++) {
    const r = reviewPosition(
      s.game.hist[ply]?.before ?? s.game.st,
      reviewHistory(s.game, ply),
      "review-v1",
      () => 0,
    );
    s = reduceSession(s, {
      type: "evaluation",
      gameId: s.game.id,
      revision: s.game.revision,
      ply,
      value: { score: ply === 0 ? 0 : -500, best: r.move, review: r.review },
    });
  }
  expect(s.game.hist[0].ann).toBe("??");
  return s;
}

it("explicit reanalysis replaces a cached live verdict and persists its replacement", async () => {
  const { reviewPosition } = await import("../../src/engine/reviewer");
  const s = await completedReviewFixture();
  localStorage.setItem("chess-prodigy-state-v3", JSON.stringify(s));
  const { result } = renderHook(() => useGame(true));
  act(() => result.current.review());
  for (let ply = 0; ply < 2; ply++) {
    const job = fake.jobs.at(-1)!;
    if (job.input.type !== "analyse") throw new Error("Expected review work");
    const r = reviewPosition(job.input.position, job.input.history, job.input.policy, () => 0);
    await act(async () => job.resolve({ ...r, score: 0 }));
  }
  expect(result.current.game.hist[0]).toMatchObject({ ann: "", better: null });
  expect(JSON.parse(localStorage.getItem("chess-prodigy-state-v3")!).game.hist[0].ann).toBe("");
});

it.each(["cancel", "undo", "new", "unmount"])(
  "rejects stale reanalysis after %s",
  async (action) => {
    const { reviewPosition } = await import("../../src/engine/reviewer");
    const s = await completedReviewFixture();
    localStorage.setItem("chess-prodigy-state-v3", JSON.stringify(s));
    const { result, unmount } = renderHook(() => useGame(true));
    act(() => result.current.review());
    const job = fake.jobs.at(-1)!;
    if (job.input.type !== "analyse") throw new Error("Expected review work");
    const r = reviewPosition(job.input.position, job.input.history, job.input.policy, () => 0);
    act(() => {
      if (action === "cancel") result.current.cancelReview();
      if (action === "undo") result.current.undo();
      if (action === "new")
        result.current.startGame({ playerColor: "w", level: "club", time: "none" });
      if (action === "unmount") unmount();
    });
    const saved = localStorage.getItem("chess-prodigy-state-v3");
    const current = result.current.game;
    await act(async () => job.resolve({ ...r, score: 700 }));
    expect(result.current.game).toBe(current);
    expect(localStorage.getItem("chess-prodigy-state-v3")).toBe(saved);
  },
);
