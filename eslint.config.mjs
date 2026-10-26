import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "@next/next/no-img-element": "warn",
      "no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/purity": "warn",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next_*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stale build output and agent worktrees — not app source.
    ".kilo/**",
    ".worktrees/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
