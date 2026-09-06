import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useHeadToHead } from "../../src/multiplayer/HeadToHead";

afterEach(() => vi.unstubAllGlobals());

const results = {
  games: [],
  rating: { rating: 1216, games: 1 },
  opponents: [
    {
      opponent: { id: "opponent", name: "Sayem", rating: 1184, games: 1 },
      wins: 1,
      losses: 0,
      draws: 0,
    },
  ],
};

it("ignores a previous account's delayed H2H response and clears results for guests", async () => {
  let finishFirst!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...results, opponents: [] }))),
  );
  const { result, rerender } = renderHook(
    ({ userId }: { userId: string | null }) => useHeadToHead(userId, "/"),
    { initialProps: { userId: "first" } as { userId: string | null } },
  );
  rerender({ userId: "second" });
  await waitFor(() => expect(result.current.history?.loading).toBe(false));
  await act(async () => finishFirst(new Response(JSON.stringify(results))));
  expect(result.current.history?.opponents).toEqual([]);
  rerender({ userId: null });
  expect(result.current.history).toBeNull();
});

it("reports a failed refresh, recovers on retry, and discards history after session expiry", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(results)))
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify(results)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Sign in again" }), { status: 401 }),
      ),
  );
  const { result } = renderHook(() => useHeadToHead("first", "/"));
  await waitFor(() => expect(result.current.history?.opponents[0]?.wins).toBe(1));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.history?.error).toBe("Connection lost"));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.history?.loading).toBe(false));
  expect(result.current.history?.error).toBe("");
  expect(result.current.history?.opponents[0]?.wins).toBe(1);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.history?.opponents).toEqual([]));
});
