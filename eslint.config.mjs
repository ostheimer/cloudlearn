// ESLint-Flat-Config fürs gesamte Monorepo.
//
// Sanfter, "warn-only"-Start (Issue #85): Es ist bewusst nur eine kleine Auswahl
// nützlicher Regeln aktiv, und alle stehen auf "warn" (Hinweis) statt "error".
// Dadurch zeigt ESLint Hinweise an, blockiert aber nie einen Merge — `eslint .`
// endet auch mit Warnungen mit Exit-Code 0.
//
// Später einzeln verschärfbar: eine Regel von "warn" auf "error" setzen, dann
// blockiert sie, bis der Verstoß behoben ist.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    // base = nur Parser + Plugin registrieren, KEINE Regeln aktivieren.
    // Wir wählen die Regeln unten selbst aus, damit der Start wirklich sanft ist.
    extends: [tseslint.configs.base],
    plugins: {
      // Nur registriert, damit die im Code bereits vorhandenen
      // eslint-disable-Kommentare für diese Standard-Plugins aufgelöst werden.
      // Ihre (lauteren) Regeln sind bewusst noch NICHT scharf geschaltet.
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    linterOptions: {
      // Sanfter Start: vorhandene eslint-disable-Kommentare (u. a. für die oben
      // noch nicht aktiven React-/Next-Regeln) nicht als "ungenutzt" melden.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-var": "warn",
      "prefer-const": "warn",
      "no-debugger": "warn",
    },
  }
);
