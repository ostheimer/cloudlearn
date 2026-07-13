// ESLint-Flat-Config fürs gesamte Monorepo — der ECHTE Linter für `pnpm lint`.
//
// Kalibriert (Issue #85, Teil 2): Basis sind die offiziellen Empfehlungen von
// @eslint/js und typescript-eslint. Regeln, die der bestehende Code bereits
// sauber besteht, bleiben auf "error" (echte Absicherung ab jetzt). Jede Regel,
// die auf vorhandenem Code (noch) anschlägt, ist bewusst auf "warn" (oder "off")
// herabgestuft. Dadurch endet `eslint .` mit Exit-Code 0 (nur Hinweise, keine
// Fehler) und CI bleibt grün — ganz ohne Änderungen am Quellcode.
//
// Bewusst NICHT gesetzt: `--max-warnings`. Warnungen sind Hinweise, kein Fehler.
// Später einzeln verschärfbar: eine Regel von "warn" auf "error" heben, den dann
// gemeldeten Verstoß beheben, fertig.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/*.min.js",
      // Von Next.js generiert — nicht lintbar/nicht unser Code.
      "**/next-env.d.ts",
    ],
  },

  // Basis-Empfehlungen: Kern-Regeln (alle Dateien) + TypeScript (ts/tsx/…).
  // Alles, was hier NICHT weiter unten herabgestuft wird, gilt als "error"
  // und ist damit echte Absicherung, weil der Code es bereits sauber besteht.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Globale Kalibrierung für Kern-Regeln, die auf vorhandenem Code anschlagen.
  {
    rules: {
      // In einem TypeScript-Projekt redundant (TS prüft undefinierte Namen selbst)
      // und in Node-Skripten/Configs sonst laut (process/module/require).
      "no-undef": "off",
      // Schlagen aktuell an → auf Hinweis herabgestuft:
      "no-useless-assignment": "warn",
      "prefer-const": "warn",
      // Zusätzliche, hilfreiche Hinweise (nicht Teil von "recommended"):
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-var": "warn",
    },
  },

  // TypeScript/React: Plugins registrieren + TS-spezifische Kalibrierung.
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      "react-hooks": reactHooks,
      // Nur registriert, damit vorhandene `eslint-disable @next/next/…`-Kommentare
      // aufgelöst werden; die Next-Regeln selbst bleiben hier bewusst aus.
      "@next/next": nextPlugin,
    },
    linterOptions: {
      // Vorhandene eslint-disable-Kommentare nicht als "ungenutzt" anmeckern.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // React Hooks: die klassische, stabile Regel wird scharf geschaltet — der
      // Code besteht sie sauber. Der Abhängigkeits-Check bleibt ein Hinweis.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // typescript-eslint-Regeln, die auf vorhandenem Code anschlagen → Hinweis:
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
    },
  }
);
