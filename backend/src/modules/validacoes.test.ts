import { describe, expect, it } from "vitest";
import { cadastroSchema, loginSchema } from "./auth/auth.controller";
import { diasSchema } from "./alunos/aluno.routes";
import { criarSchema } from "./programacoes/programacao.routes";
import { localizacaoSchema } from "./viagens/viagem.controller";

const uuid = "8a6e0804-2bd0-4672-b79d-d97027f9071a";

describe("validação das entradas da API", () => {
  it("e-mail é normalizado (espaços e maiúsculas)", () => {
    expect(loginSchema.parse({ email: "  Aluno@BusOn.COM ", senha: "x" }).email).toBe("aluno@buson.com");
  });

  it("cadastro exige senha de 6+ caracteres e universidade válida", () => {
    const base = { nome: "Marina", email: "m@x.com", senha: "123456", universidadeId: uuid };
    expect(cadastroSchema.safeParse(base).success).toBe(true);
    expect(cadastroSchema.safeParse({ ...base, senha: "12345" }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...base, universidadeId: "ufma" }).success).toBe(false);
  });

  it("dias fixos: sem dia repetido, dia de 0 a 6 e sem campos extras", () => {
    const dia = (diaSemana: number) => ({ diaSemana, rotaId: uuid });
    expect(diasSchema.safeParse({ dias: [dia(1), dia(3)] }).success).toBe(true);
    expect(diasSchema.safeParse({ dias: [dia(1), dia(1)] }).success).toBe(false);
    expect(diasSchema.safeParse({ dias: [dia(7)] }).success).toBe(false);
    expect(diasSchema.safeParse({ dias: [{ ...dia(1), alunoId: uuid }] }).success).toBe(false);
  });

  it("programação: horário HH:MM e ao menos um dia, sem repetir", () => {
    const base = { rotaId: uuid, onibusId: uuid, motoristaId: uuid, horarioIda: "06:30", diasSemana: [1, 3, 5] };
    expect(criarSchema.safeParse(base).success).toBe(true);
    expect(criarSchema.safeParse({ ...base, horarioIda: "6:30" }).success).toBe(false);
    expect(criarSchema.safeParse({ ...base, horarioIda: "24:00" }).success).toBe(false);
    expect(criarSchema.safeParse({ ...base, diasSemana: [] }).success).toBe(false);
    expect(criarSchema.safeParse({ ...base, diasSemana: [1, 1] }).success).toBe(false);
  });

  it("GPS: aceita lote ou uma leitura só (o formato antigo vira lote)", () => {
    const lote = localizacaoSchema.parse({ pontos: [{ latitude: -5.5, longitude: -47.4, registradoEm: "2026-10-11T12:00:00Z" }] });
    expect(lote.pontos[0].registradoEm).toBeInstanceOf(Date);
    expect(localizacaoSchema.parse({ latitude: -5.5, longitude: -47.4 }).pontos).toHaveLength(1);
    expect(localizacaoSchema.safeParse({ pontos: [] }).success).toBe(false);
    expect(localizacaoSchema.safeParse({ latitude: 95, longitude: 0 }).success).toBe(false);
  });
});
