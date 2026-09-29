// ESLint da API (roda no CI): regras recomendadas de JavaScript e TypeScript.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "prisma/migrations/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Variáveis descartadas de propósito começam com "_"
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  {
    // Testes E2E e scripts em JavaScript puro
    files: ["test/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  }
);
