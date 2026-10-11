import { defineConfig } from "vitest/config";

// Testes unitários das regras puras (sem banco). Os testes de ponta a ponta ficam em test/e2e.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      TZ: "America/Fortaleza",
      // Só para o config/env.ts carregar: nenhum teste unitário abre conexão com o banco
      DATABASE_URL: "mysql://teste:teste@127.0.0.1:3306/bus_on_unitario",
      JWT_SECRET: "segredo-apenas-dos-testes-unitarios",
    },
  },
});
