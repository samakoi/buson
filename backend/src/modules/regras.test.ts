import { describe, expect, it } from "vitest";
import { diferenca } from "./auditoria/auditoria.service";
import { distanciaMetros } from "./gps/localizacao.service";

describe("auditoria: diferenca", () => {
  it("guarda só os campos que mudaram", () => {
    const r = diferenca({ nome: "UFMA", endereco: "Centro", latitude: 1 }, { nome: "UFMA", endereco: "Bacuri" });
    expect(r).toEqual({ valorAnterior: { endereco: "Centro" }, valorNovo: { endereco: "Bacuri" }, mudou: true });
  });

  it("ignora campos não enviados e compara listas pelo conteúdo", () => {
    const r = diferenca({ dias: [1, 2], nome: "x" }, { dias: [1, 2], nome: undefined });
    expect(r.mudou).toBe(false);
  });

  it("registra null quando o valor anterior não existia", () => {
    const r = diferenca<{ observacao?: string | null }>({}, { observacao: "pneu" });
    expect(r.valorAnterior).toEqual({ observacao: null });
  });
});

describe("GPS: distanciaMetros (haversine)", () => {
  const a = { latitude: -5.5199, longitude: -47.4794 };
  const b = { latitude: -5.5263, longitude: -47.4917 };

  it("é zero no mesmo ponto e simétrica", () => {
    expect(distanciaMetros(a, a)).toBe(0);
    expect(distanciaMetros(a, b)).toBe(distanciaMetros(b, a));
  });

  it("1 grau de latitude ≈ 111 km", () => {
    const d = distanciaMetros({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it("distância curta dentro da cidade (cerca de 1,5 km)", () => {
    const d = distanciaMetros(a, b);
    expect(d).toBeGreaterThan(1_400);
    expect(d).toBeLessThan(1_600);
  });
});
