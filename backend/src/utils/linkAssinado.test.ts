import { afterEach, describe, expect, it, vi } from "vitest";
import { assinarLink, verificarLink } from "./linkAssinado";

function ler(query: string) {
  const p = new URLSearchParams(query);
  return { expira: Number(p.get("expira")), assinatura: p.get("assinatura")! };
}

describe("links assinados", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aceita o link gerado para o mesmo recurso e id", () => {
    const { expira, assinatura } = ler(assinarLink("documento", "abc").query);
    expect(() => verificarLink("documento", "abc", expira, assinatura)).not.toThrow();
  });

  it("recusa outro id, outro recurso, expiração alterada ou assinatura cortada", () => {
    const { expira, assinatura } = ler(assinarLink("documento", "abc").query);
    const invalido = expect.objectContaining({ codigo: "LINK_INVALIDO" });
    expect(() => verificarLink("documento", "outro", expira, assinatura)).toThrowError(invalido);
    expect(() => verificarLink("falta", "abc", expira, assinatura)).toThrowError(invalido);
    expect(() => verificarLink("documento", "abc", expira + 3600, assinatura)).toThrowError(invalido);
    expect(() => verificarLink("documento", "abc", expira, assinatura.slice(1))).toThrowError(invalido);
  });

  it("vale 5 minutos", () => {
    vi.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") });
    const { expira, assinatura } = ler(assinarLink("documento", "abc").query);
    vi.setSystemTime(new Date("2026-10-11T12:04:59Z"));
    expect(() => verificarLink("documento", "abc", expira, assinatura)).not.toThrow();
    vi.setSystemTime(new Date("2026-10-11T12:05:01Z"));
    expect(() => verificarLink("documento", "abc", expira, assinatura)).toThrow();
  });
});
