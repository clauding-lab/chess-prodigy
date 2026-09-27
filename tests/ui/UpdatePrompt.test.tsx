import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { UpdatePrompt } from "../../src/ui/UpdatePrompt";
import { soleAppClient } from "../../src/ui/update-gate";
const pwa = vi.hoisted(() => ({
  update: vi.fn(),
  need: true,
  reload: undefined as (() => void) | undefined,
}));
vi.mock("../../src/ui/update-gate", async (original) => ({
  ...(await original<typeof import("../../src/ui/update-gate")>()),
  soleAppClient: vi.fn(async () => true),
}));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onNeedReload?: () => void }) => {
    pwa.reload = options.onNeedReload;
    return {
      needRefresh: [pwa.need, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: pwa.update,
    };
  },
}));
beforeEach(() => {
  pwa.update.mockClear();
  pwa.reload = undefined;
  vi.mocked(soleAppClient).mockReset().mockResolvedValue(true);
});
it("defers updates during active play and saves before an explicitly accepted update", async () => {
  const save = vi.fn(() => true);
  const view = render(<UpdatePrompt active save={save} />);
  expect(pwa.update).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Update now" })).toBe(null);
  view.rerender(<UpdatePrompt active={false} save={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  expect(save).toHaveBeenCalledOnce();
  await waitFor(() => expect(pwa.update).toHaveBeenCalledWith(true));
});
it("retains the current app when saving before update fails", async () => {
  render(<UpdatePrompt active={false} save={() => false} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  expect(pwa.update).not.toHaveBeenCalled();
  expect((await screen.findByRole("alert")).textContent).toContain("save");
});
it("keeps a discoverable update action after Later", () => {
  render(<UpdatePrompt active={false} save={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  expect(screen.queryByRole("button", { name: "Update now" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Update available" }));
  expect(screen.getByRole("button", { name: "Update now" })).toBeTruthy();
});
it("blocks the idle friend-view prompt when the hidden practice view is active", async () => {
  render(
    <>
      <UpdatePrompt active save={() => true} />
      <UpdatePrompt active={false} save={() => true} />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  expect((await screen.findByRole("alert")).textContent).toContain("game");
  expect(pwa.update).not.toHaveBeenCalled();
});

it("does not save or reload for another tab's activation without this tab's consent", () => {
  const save = vi.fn(() => true);
  render(<UpdatePrompt active={false} save={save} />);
  act(() => pwa.reload?.());
  expect(save).not.toHaveBeenCalled();
  expect(pwa.update).not.toHaveBeenCalled();
});

it("cancels a delayed update and retained reload callback after unmount", async () => {
  let release!: (safe: boolean) => void;
  vi.mocked(soleAppClient).mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      release = resolve;
    }),
  );
  const save = vi.fn(() => true);
  const view = render(<UpdatePrompt active={false} save={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  const lateReload = pwa.reload!;
  view.unmount();
  await act(async () => {
    release(true);
  });
  expect(pwa.update).not.toHaveBeenCalled();
  save.mockClear();
  act(lateReload);
  expect(save).not.toHaveBeenCalled();
});

it("rechecks active play when its requested worker eventually takes control", async () => {
  const view = render(<UpdatePrompt active={false} save={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  await waitFor(() => expect(pwa.update).toHaveBeenCalledOnce());
  view.rerender(<UpdatePrompt active save={() => true} />);
  act(() => pwa.reload?.());
  expect((await screen.findByRole("alert")).textContent).toContain("game");
});

it("postpones requested reload when the latest save fails", async () => {
  const view = render(<UpdatePrompt active={false} save={() => true} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  await waitFor(() => expect(pwa.update).toHaveBeenCalledOnce());
  view.rerender(<UpdatePrompt active={false} save={() => false} />);
  act(() => pwa.reload?.());
  expect((await screen.findByRole("alert")).textContent).toContain("save");
});
