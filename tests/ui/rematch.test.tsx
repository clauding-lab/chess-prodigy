import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SetupModal, type SetupDraft } from "../../src/ui/Modals";
import { freshSession } from "../../src/game/state";

const clockNote = "Original clock setting was not recorded; choose a time control.";
function RematchFixture() {
  const [draft, setDraft] = useState<SetupDraft>({
    color: "w",
    level: "casual",
    time: "none",
    opponentId: "attack-development",
    opponentVersion: 2,
  });
  const session = freshSession(0, "rematch-copy");
  return (
    <SetupModal
      draft={draft}
      setDraft={setDraft}
      game={session.game}
      rating={session.rating}
      onStart={() => {}}
      betaEnabled
      rematchNote={clockNote}
    />
  );
}

it.each(["Paul Morphy", "Classic"])(
  "updates the earlier-opponent explanation after choosing %s while retaining the clock warning",
  (opponent) => {
    render(<RematchFixture />);
    expect(screen.getByText(/This rematch keeps the earlier opponent/)).toBeTruthy();
    expect(screen.getByText(clockNote)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: opponent, exact: true }));
    expect(screen.queryByText(/This rematch keeps the earlier opponent/)).toBeNull();
    expect(screen.getByText(clockNote)).toBeTruthy();
    if (opponent === "Paul Morphy")
      expect(screen.getByRole("button", { name: "Casual 1275", exact: true })).toBeTruthy();
  },
);
