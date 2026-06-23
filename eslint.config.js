// Flat ESLint config (ESLint 9 + typescript-eslint 8).
// Intentionally conservative so it can be adopted on a large existing codebase
// without drowning in noise: correctness rules are errors, stylistic ones are
// off or warnings. Tighten over time.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "drizzle/meta/**",
      "patches/**",
      "**/*.config.js",
      "**/*.config.ts",
      "seed-blog.mjs",
    ],
  },

  // Base JS + TS (syntax-only, fast — applies everywhere).
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server + shared: enable type-aware linting so we can catch unawaited
  // promises (e.g. the recurring `getDb()` / `.insert()` without await bug).
  {
    files: ["server/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },

  // Client: browser globals + React Hooks correctness.
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": (await import("eslint-plugin-react-hooks")).default,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Project-wide rule tuning. Kept lenient on purpose.
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      // The codebase deliberately uses `any` at integration boundaries.
      "@typescript-eslint/no-explicit-any": "off",
      // Let unused-imports own unused detection: it auto-removes unused IMPORTS
      // (side-effect-free) on --fix, while only *reporting* unused variables
      // (which may have side-effecting initializers — never auto-deleted).
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },

  // Must be last: turn off rules that conflict with Prettier formatting.
  prettier,
);
