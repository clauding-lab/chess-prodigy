import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AccountShell } from "./account/AccountShell";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccountShell />
  </StrictMode>,
);
