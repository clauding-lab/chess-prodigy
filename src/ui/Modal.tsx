import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const dialogStack: HTMLElement[] = [];
const originalInert = new Map<Element, boolean>();
function syncInert() {
  const top = dialogStack.at(-1);
  for (const child of Array.from(document.body.children)) {
    if (!originalInert.has(child)) originalInert.set(child, child.hasAttribute("inert"));
    child.toggleAttribute("inert", top ? child !== top : originalInert.get(child));
  }
  if (!top) originalInert.clear();
}

export interface ModalProps {
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export function Modal({
  title,
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const [portal] = useState(() => {
    const node = document.createElement("div");
    node.dataset.modalRoot = "";
    return node;
  });

  useEffect(() => {
    document.body.appendChild(portal);
    dialogStack.push(portal);
    syncInert();
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (nodes[0] ?? dialogRef.current)?.focus();
    return () => {
      const wasTop = dialogStack.at(-1) === portal;
      const index = dialogStack.indexOf(portal);
      if (index !== -1) dialogStack.splice(index, 1);
      portal.remove();
      originalInert.delete(portal);
      syncInert();
      if (wasTop && restoreRef.current?.isConnected) restoreRef.current.focus();
    };
  }, [portal]);

  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && closeOnEscape && onClose) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!nodes.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop) onClose?.();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal ${className}`.trim()}
        onKeyDown={keyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>,
    portal,
  );
}
