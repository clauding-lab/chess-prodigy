import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default tseslint.config(
 {ignores:["node_modules/**","dist/**","reference/**","verification/**","playwright-report/**","test-results/**","tests/**","docs/**"]},
 {files:["src/**/*.{ts,tsx}","server/**/*.ts","scripts/test-account-server.ts","deploy/*.mjs"],extends:[js.configs.recommended,...tseslint.configs.recommended],plugins:{"react-hooks":hooks},rules:{...hooks.configs.recommended.rules,"@typescript-eslint/no-unused-vars":["error",{argsIgnorePattern:"^_",varsIgnorePattern:"^_"}],"no-undef":"off"}}
);
