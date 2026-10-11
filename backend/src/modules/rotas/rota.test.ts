import { describe, expect, it } from "vitest";
import { deLegado, formatarRota, rotaEdicaoSchema, rotaSchema, RotaCompleta, trechoSchema } from "./rota.service";

const u = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const trecho = { origem: "Centro", destino: "UFMA", universidadeIds: [u(1)], pontosEmbarqueIds: [u(5), u(6)] };

describe("validação dos trechos", () => {
  it("aceita origem, destino, instituições e pontos (pontos são opcionais)", () => {
    expect(trechoSchema.safeParse(trecho).success).toBe(true);
    expect(trechoSchema.parse({ ...trecho, pontosEmbarqueIds: undefined }).pontosEmbarqueIds).toEqual([]);
  });

  it.each([
    ["origem curta", { origem: "C" }],
    ["destino vazio", { destino: "   " }],
    ["origem longa", { origem: "x".repeat(81) }],
    ["sem instituição", { universidadeIds: [] }],
    ["instituição repetida no trecho", { universidadeIds: [u(1), u(1)] }],
    ["ponto repetido no trecho", { pontosEmbarqueIds: [u(5), u(5)] }],
    ["id inválido", { universidadeIds: ["ufma"] }],
    ["campo desconhecido", { horario: "07:00" }],
  ])("recusa %s", (_nome, mudanca) => {
    expect(trechoSchema.safeParse({ ...trecho, ...mudanca }).success).toBe(false);
  });

  it("rota nova exige ida e volta; a edição aceita só um trecho e a versão", () => {
    expect(rotaSchema.safeParse({ ida: trecho }).success).toBe(false);
    expect(rotaSchema.safeParse({ ida: trecho, volta: trecho }).success).toBe(true);
    expect(rotaEdicaoSchema.safeParse({ volta: trecho, versao: "2026-10-11T12:00:00.000Z" }).success).toBe(true);
    expect(rotaEdicaoSchema.safeParse({ versao: "ontem" }).success).toBe(false);
  });

  it("o mesmo ponto pode estar na ida e na volta", () => {
    expect(rotaSchema.safeParse({ ida: trecho, volta: { ...trecho, origem: "UFMA", destino: "Centro" } }).success).toBe(true);
  });
});

// Rota como o Prisma devolve (com paradas dos dois sentidos misturadas)
function rotaFalsa(): RotaCompleta {
  const agora = new Date("2026-10-11T12:00:00Z");
  const uni = (id: string, nome: string) => ({ id, nome, endereco: null, latitude: null, longitude: null, criadoEm: agora });
  const ponto = (id: string, nome: string) => ({
    id,
    nome,
    endereco: null,
    latitude: null,
    longitude: null,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  });
  return {
    id: "r1",
    nome: "Centro ↔ Instituições",
    criadoEm: agora,
    atualizadoEm: agora,
    excluidaEm: null,
    trechos: [
      { id: "t1", rotaId: "r1", sentido: "IDA", origem: "Centro", destino: "UFMA", criadoEm: agora, atualizadoEm: agora },
      { id: "t2", rotaId: "r1", sentido: "VOLTA", origem: "UFMA", destino: "Bacuri", criadoEm: agora, atualizadoEm: agora },
    ],
    pontos: [
      { id: "a", rotaId: "r1", universidadeId: "u1", sentido: "IDA", ordem: 1, universidade: uni("u1", "CEUMA") },
      { id: "b", rotaId: "r1", universidadeId: "u2", sentido: "IDA", ordem: 2, universidade: uni("u2", "UFMA") },
      { id: "c", rotaId: "r1", universidadeId: "u2", sentido: "VOLTA", ordem: 1, universidade: uni("u2", "UFMA") },
    ],
    pontosEmbarque: [
      { id: "d", rotaId: "r1", pontoEmbarqueId: "p1", sentido: "IDA", ordem: 1, pontoEmbarque: ponto("p1", "Praça") },
      { id: "e", rotaId: "r1", pontoEmbarqueId: "p2", sentido: "IDA", ordem: 2, pontoEmbarque: ponto("p2", "Terminal") },
      { id: "f", rotaId: "r1", pontoEmbarqueId: "p3", sentido: "VOLTA", ordem: 1, pontoEmbarque: ponto("p3", "Bacuri") },
    ],
  } as RotaCompleta;
}

describe("formatarRota", () => {
  it("separa as paradas de cada trecho e mantém a ordem", () => {
    const r = formatarRota(rotaFalsa());
    expect(r.trechos.ida).toMatchObject({ origem: "Centro", destino: "UFMA" });
    expect(r.trechos.ida.instituicoes.map((p) => p.universidade.nome)).toEqual(["CEUMA", "UFMA"]);
    expect(r.trechos.volta.instituicoes.map((p) => p.universidade.nome)).toEqual(["UFMA"]);
    expect(r.trechos.volta.pontosEmbarque.map((p) => p.pontoEmbarque.nome)).toEqual(["Bacuri"]);
  });

  it("pontos/pontosEmbarque (clientes antigos) repetem a ida", () => {
    const r = formatarRota(rotaFalsa());
    expect(r.pontos.map((p) => p.universidadeId)).toEqual(["u1", "u2"]);
    expect(r.pontosEmbarque.map((p) => p.pontoEmbarqueId)).toEqual(["p1", "p2"]);
  });
});

describe("formato antigo do app (uma lista para os dois sentidos)", () => {
  it("edição: aplica a lista nos dois trechos, com os pontos invertidos na volta, e mantém origem e destino", async () => {
    const edicao = await deLegado(null as never, { pontosEmbarqueIds: ["p2", "p1", "p9"] }, rotaFalsa());
    expect(edicao.ida).toEqual({ origem: "Centro", destino: "UFMA", universidadeIds: ["u1", "u2"], pontosEmbarqueIds: ["p2", "p1", "p9"] });
    expect(edicao.volta).toEqual({
      origem: "UFMA",
      destino: "Bacuri",
      universidadeIds: ["u1", "u2"],
      pontosEmbarqueIds: ["p9", "p1", "p2"],
    });
  });

  it("só o nome: não mexe nos trechos", async () => {
    expect(await deLegado(null as never, { nome: "Rota Nova" }, rotaFalsa())).toEqual({ nome: "Rota Nova" });
  });
});
