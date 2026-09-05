import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { UpdatePrompt } from "../../src/ui/UpdatePrompt";
const pwa = vi.hoisted(() => ({ update: vi.fn(), need: true }));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [pwa.need, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: pwa.update,
  }),
}));
beforeEach(() => pwa.update.mockClear());
it("defers updates during active play and saves before an explicitly accepted update", () => {
  const save = vi.fn(() => true);
  const view = render(<UpdatePrompt active save={save} />);
  expect(pwa.update).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Update now" })).toBe(null);
  view.rerender(<UpdatePrompt active={false} save={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  expect(save).toHaveBeenCalledOnce();
  expect(pwa.update).toHaveBeenCalledWith(true);
});
it("retains the current app when saving before update fails", () => {
  render(<UpdatePrompt active={false} save={() => false} />);
  fireEvent.click(screen.getByRole("button", { name: "Update now" }));
  expect(pwa.update).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("save");
});
