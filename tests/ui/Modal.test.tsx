import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Modal } from "../../src/ui/Modal";

function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal title="Choose" onClose={() => setOpen(false)}>
          <button>First</button>
          <button>Last</button>
        </Modal>
      )}
    </>
  );
}

it("traps focus, closes with Escape and restores focus to its trigger", () => {
  render(<Fixture />);
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
});

it("keeps its dialog attached through StrictMode setup and cleanup", () => {
  const view = render(
    <React.StrictMode>
      <Modal title="Strict dialog">
        <button>Continue</button>
      </Modal>
    </React.StrictMode>,
  );
  expect(screen.getByRole("dialog").isConnected).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  view.unmount();
  expect(document.querySelectorAll("[data-modal-root]")).toHaveLength(0);
});

it("keeps the page inert until the last stacked dialog closes", () => {
  function Stack() {
    const [first, setFirst] = useState(true),
      [second, setSecond] = useState(true);
    return (
      <>
        <button>Page</button>
        {first && (
          <Modal title="First dialog">
            <button onClick={() => setFirst(false)}>Close first</button>
          </Modal>
        )}
        {second && (
          <Modal title="Second dialog">
            <button onClick={() => setSecond(false)}>Close second</button>
          </Modal>
        )}
      </>
    );
  }
  const view = render(<Stack />);
  const roots = document.querySelectorAll("[data-modal-root]");
  expect(roots[0].hasAttribute("inert")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close second" }));
  expect(view.container.hasAttribute("inert")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close first" }));
  expect(view.container.hasAttribute("inert")).toBe(false);
});
