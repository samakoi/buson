import { describe, expect, it } from "vitest";
import { PERMISSOES_POR_PAPEL, temPermissao } from "./permissoes";

describe("permissões por papel", () => {
  it("aluno só mexe no que é dele", () => {
    expect(temPermissao("ALUNO", "aluno:proprio")).toBe(true);
    expect(temPermissao("ALUNO", "checkin:fazer")).toBe(true);
    expect(temPermissao("ALUNO", "alunos:ler")).toBe(false);
    expect(temPermissao("ALUNO", "viagem:operar")).toBe(false);
  });

  it("motorista opera a viagem, mas não administra", () => {
    expect(temPermissao("MOTORISTA", "viagem:operar")).toBe(true);
    expect(temPermissao("MOTORISTA", "viagem:passageiros")).toBe(true);
    expect(temPermissao("MOTORISTA", "viagens:gerenciar")).toBe(false);
    expect(temPermissao("MOTORISTA", "checkin:fazer")).toBe(false);
  });

  it("administração não faz check-in nem opera ônibus", () => {
    expect(temPermissao("ADMIN", "alunos:gerenciar")).toBe(true);
    expect(temPermissao("ADMIN", "checkin:fazer")).toBe(false);
    expect(temPermissao("ADMIN", "viagem:operar")).toBe(false);
  });

  it("papel desconhecido não tem permissão nenhuma", () => {
    expect(temPermissao("VISITANTE" as never, "dashboard:ler")).toBe(false);
  });

  it("todo papel tem ao menos uma permissão e nenhuma repetida", () => {
    for (const [papel, lista] of Object.entries(PERMISSOES_POR_PAPEL)) {
      expect(lista.length, papel).toBeGreaterThan(0);
      expect(new Set(lista).size, papel).toBe(lista.length);
    }
  });
});
