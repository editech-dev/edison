import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Existing code still has ~38 explicit `any` (chat, CV, Redis helpers). Reported as warnings
    // until they are typed, so the lint gate can block new errors meanwhile.
    // react-hooks v7 (React Compiler rules) flags two existing, working patterns: functions used
    // before their declaration in the particles animation, and reading the saved language in an
    // effect (hydration-safe). Warnings until those components are refactored.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);
