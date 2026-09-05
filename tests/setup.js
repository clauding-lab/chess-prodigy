// Align jsdom typed arrays with Node TextEncoder for the source compiler.
globalThis.Uint8Array = new TextEncoder().encode("").constructor;

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
