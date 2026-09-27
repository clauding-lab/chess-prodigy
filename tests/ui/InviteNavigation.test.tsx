import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Multiplayer } from "../../src/multiplayer/Multiplayer";

const { joinInvite } = vi.hoisted(() => ({
  joinInvite: vi.fn(async () => ({ id: "joined-game", status: "active" })),
}));
vi.mock("../../src/multiplayer/api", () => ({
  joinInvite,
  listGames: vi.fn(),
  readGame: vi.fn(),
  actOnGame: vi.fn(),
  createInvite: vi.fn(),
}));

it("replaces a consumed invitation in browser history", async () => {
  const navigate = vi.fn();
  await act(async () => {
    render(
      <Multiplayer
        user={{ id: "player", name: "Player", email: "player@example.test" }}
        path="/invite/token"
        navigate={navigate}
        controls={null}
        onSignIn={vi.fn()}
      />,
    );
  });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/game/joined-game", { replace: true }),
  );
  expect(joinInvite).toHaveBeenCalledWith("player", "token");
});
