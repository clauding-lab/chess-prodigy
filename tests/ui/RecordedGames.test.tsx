import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecordedGamesModal } from "../../src/ui/RecordedGames";
import { CLASSIC, morphyConfig } from "../../src/engine/opponents";
import type { GameRecord } from "../../src/account/types";

const record: GameRecord = {
  recordVersion: 2,
  id: "one",
  opponent: { ...CLASSIC },
  unratedReason: null,
  assisted: false,
  result: "0-1",
  reason: "Resignation",
  level: "club",
  playerColor: "w",
  time: "none",
  rated: true,
  moves: ["e4", "e5"],
  completedAt: "2026-09-11T12:00:00+06:00",
};
const props = () => ({
  history: { status: "ready" as const, games: [record] },
  target: record,
  scope: "guest" as const,
  betaEnabled: false,
  onRematch: vi.fn(),
  onClose: vi.fn(),
  onRetry: vi.fn(),
  loading: false,
  error: null,
});
it("legally replays recorded moves with navigation without mutating the record", () => {
  const p = props(),
    before = structuredClone(record);
  render(<RecordedGamesModal {...p} />);
  expect(screen.getByText(/200 completed games/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Replay recorded game 1" }));
  const dialog = screen.getByRole("dialog");
  expect(
    (within(dialog).getByRole("button", { name: "e2, white pawn" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Next move" }));
  expect(within(dialog).getByRole("button", { name: "e4, white pawn" })).toBeTruthy();
  fireEvent.change(within(dialog).getByRole("slider", { name: "Replay position" }), {
    target: { value: "2" },
  });
  expect(within(dialog).getByRole("button", { name: "e5, black pawn" })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Previous move" }));
  expect(within(dialog).getByRole("button", { name: "e7, black pawn" })).toBeTruthy();
  expect(record).toEqual(before);
  expect(p.onRematch).not.toHaveBeenCalled();
});
it("reports illegal archived moves instead of rendering an invented position", () => {
  render(
    <RecordedGamesModal
      {...props()}
      history={{ status: "ready", games: [{ ...record, moves: ["e5"] }] }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Replay recorded game 1" }));
  expect(screen.getByRole("alert").textContent).toContain("cannot be legally replayed");
  expect(screen.queryByRole("group", { name: "Chess board" })).toBeNull();
});
it("keeps beta and unknown versions replayable but prevents silent Classic rematches", () => {
  const beta = {
    ...record,
    opponent: morphyConfig(7),
    rated: false,
    unratedReason: "beta" as const,
  };
  const p = props();
  const { rerender } = render(
    <RecordedGamesModal {...p} target={beta} history={{ status: "ready", games: [beta] }} />,
  );
  expect(
    (screen.getByRole("button", { name: "Rematch recorded game 1" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  rerender(
    <RecordedGamesModal
      {...p}
      betaEnabled
      target={beta}
      history={{ status: "ready", games: [beta] }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Rematch recorded game 1" }));
  expect(p.onRematch).toHaveBeenCalledWith(beta);
  rerender(
    <RecordedGamesModal
      {...p}
      betaEnabled
      target={beta}
      history={{
        status: "ready",
        games: [{ ...beta, opponent: { ...beta.opponent, version: 99 } }],
      }}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Opponent and difficulty" }), {
    target: {
      value: JSON.stringify(["attack-development", 99, "style-v1", "seeded-per-ply-v1", "club"]),
    },
  });
  expect(
    (screen.getByRole("button", { name: "Rematch recorded game 1" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("separates assistance, difficulty and pending results with recoverable errors", () => {
  const p = props(),
    assisted = {
      ...record,
      id: "two",
      assisted: true,
      rated: false,
      unratedReason: "hint" as const,
    };
  render(
    <RecordedGamesModal
      {...p}
      history={{
        status: "incomplete",
        pending: true,
        games: [record, assisted, { ...record, id: "strong", level: "strong" }],
      }}
      error="History request failed"
    />,
  );
  expect(screen.getByRole("region", { name: "Recorded rivalry" }).textContent).toContain(
    "2 recorded games",
  );
  expect(screen.getByText(/waiting to sync/)).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("History request failed");
  fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
  expect(p.onRetry).toHaveBeenCalledOnce();
});

it("supports keyboard replay and starts with the recorded player's orientation", () => {
  render(
    <RecordedGamesModal
      {...props()}
      history={{ status: "ready", games: [{ ...record, playerColor: "b" }] }}
    />,
  );
  const open = screen.getByRole("button", { name: "Replay recorded game 1" });
  fireEvent.click(open);
  const replay = screen.getByRole("region", { name: "Recorded game replay" });
  expect(document.activeElement).toBe(replay);
  expect(
    within(replay)
      .getByRole("group", { name: "Chess board" })
      .firstElementChild?.getAttribute("aria-label"),
  ).toBe("h1, white rook");
  const slider = within(replay).getByRole("slider", { name: "Replay position" });
  fireEvent.keyDown(slider, { key: "End" });
  expect((slider as HTMLInputElement).value).toBe("2");
  expect((screen.getByRole("button", { name: "Next move" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.keyDown(slider, { key: "ArrowLeft" });
  expect((slider as HTMLInputElement).value).toBe("1");
  fireEvent.keyDown(slider, { key: "Home" });
  expect((slider as HTMLInputElement).value).toBe("0");
  expect(
    (screen.getByRole("button", { name: "Previous move" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Flip replay board" }));
  expect(
    within(replay)
      .getByRole("group", { name: "Chess board" })
      .firstElementChild?.getAttribute("aria-label"),
  ).toBe("a8, black rook");
  fireEvent.click(screen.getByRole("button", { name: "Close replay" }));
  expect(screen.queryByRole("group", { name: "Chess board" })).toBeNull();
  expect(document.activeElement).toBe(open);
});

it("scopes retained WDL by assistance and version from the player's colour", () => {
  render(
    <RecordedGamesModal
      {...props()}
      history={{
        status: "ready",
        games: [
          { ...record, playerColor: "b" },
          { ...record, id: "assist", assisted: true },
          { ...record, id: "legacy", assisted: null, result: "½-½" },
          { ...record, id: "version", opponent: { ...CLASSIC, version: 2 } },
        ],
      }}
    />,
  );
  const summary = screen.getByRole("region", { name: "Recorded rivalry" });
  expect(summary.textContent).toContain("3 recorded games");
  expect(within(summary).getByRole("row", { name: "Unassisted 1 0 0" })).toBeTruthy();
  expect(within(summary).getByRole("row", { name: "Assisted 0 0 1" })).toBeTruthy();
  expect(within(summary).getByRole("row", { name: "Unknown assistance 0 1 0" })).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Opponent and difficulty" }), {
    target: { value: JSON.stringify(["classic", 2, "classic-v1", "ambient-v1", "club"]) },
  });
  expect(summary.textContent).toContain("1 recorded game");
  expect(screen.getAllByRole("button", { name: /Replay recorded game/ })).toHaveLength(1);
  expect(
    (screen.getByRole("button", { name: "Rematch recorded game 1" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("shows unavailable and incomplete history honestly, with loading and retry", () => {
  const p = props();
  const { rerender } = render(
    <RecordedGamesModal
      {...p}
      scope="account"
      loading
      history={{ status: "unavailable", games: [] }}
    />,
  );
  expect(screen.getByText(/this account only/i)).toBeTruthy();
  expect(screen.getByText(/history is unavailable/i)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Refresh records" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  rerender(<RecordedGamesModal {...p} history={{ status: "incomplete", games: [] }} />);
  expect(screen.getByText(/this browser only/i)).toBeTruthy();
  expect(screen.getByText(/history is incomplete/i)).toBeTruthy();
  expect(screen.queryByText("No completed games yet.")).toBeNull();
});

it("preserves raw corrupt history in a recoverable download", async () => {
  const raw = '{"broken":';
  const blobs: Blob[] = [];
  const create = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:recovery";
  });
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    render(<RecordedGamesModal {...props()} history={{ status: "corrupt", games: [], raw }} />);
    expect(screen.getByRole("alert").textContent).toMatch(/kept for recovery/i);
    fireEvent.click(screen.getByRole("button", { name: "Download original history" }));
    expect(blobs).toHaveLength(1);
    const contents = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(blobs[0]);
    });
    expect(contents).toBe(raw);
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
      "chess-prodigy-history-recovery.txt",
    );
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("does not invent a missing time control and formats recorded dates in BDT", () => {
  const legacy = { ...record };
  delete legacy.time;
  const { rerender } = render(
    <RecordedGamesModal {...props()} history={{ status: "ready", games: [legacy] }} />,
  );
  expect(screen.queryByText(/No clock/)).toBeNull();
  expect(screen.getByText(/12:00.*BDT/)).toBeTruthy();
  rerender(<RecordedGamesModal {...props()} history={{ status: "ready", games: [record] }} />);
  expect(screen.getByText(/No clock/)).toBeTruthy();
});

it("does not present unknown totals as zero completed games", () => {
  const { rerender } = render(
    <RecordedGamesModal {...props()} history={{ status: "corrupt", games: [] }} />,
  );
  const summary = screen.getByRole("region", { name: "Recorded rivalry" });
  expect(summary.textContent).toContain("Recorded totals unavailable");
  expect(within(summary).queryByRole("table")).toBeNull();
  rerender(<RecordedGamesModal {...props()} history={{ status: "incomplete", games: [] }} />);
  expect(summary.textContent).toContain("Recorded totals unavailable");
  expect(within(summary).queryByRole("table")).toBeNull();
  expect(screen.getByText(/current game clock continues/i)).toBeTruthy();
});

it("keeps the recovery action available when a download cannot start", () => {
  vi.stubGlobal("URL", {
    createObjectURL: () => {
      throw new Error("Unsupported");
    },
  });
  try {
    render(
      <RecordedGamesModal
        {...props()}
        history={{ status: "corrupt", games: [], raw: "broken bytes" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download original history" }));
    expect(
      screen
        .getAllByRole("alert")
        .map((alert) => alert.textContent)
        .join(" "),
    ).toContain("download could not start");
    expect(
      (screen.getByRole("button", { name: "Download original history" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("drops a replay if its current history no longer contains that game", () => {
  const { rerender } = render(<RecordedGamesModal {...props()} />);
  fireEvent.click(screen.getByRole("button", { name: "Replay recorded game 1" }));
  expect(screen.getByRole("group", { name: "Chess board" })).toBeTruthy();
  rerender(
    <RecordedGamesModal {...props()} scope="account" history={{ status: "ready", games: [] }} />,
  );
  expect(screen.queryByRole("group", { name: "Chess board" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Rematch recorded game 1" })).toBeNull();
});
