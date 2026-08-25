const globals = require("globals");

module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "ChatGPT - **",
      "**/*_files/**",
      "personal_interests_codex_spec.md",
      "personal_website_improvement_plan.md",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-fallthrough": "error",
      "no-irregular-whitespace": "error",
      "no-redeclare": "error",
      "no-self-assign": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "caughtErrors": "none" }],
      "no-useless-assignment": "error",
      "no-useless-catch": "error",
      "prefer-const": "error",
    },
  },
];
