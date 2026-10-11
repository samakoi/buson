import { Formulario, formularioInicial, validarFormulario, voltaDaIda } from "../formularioViagem";
import type { Programacao, Rota } from "../../../types";

const ida = { origem: "Centro", destino: "UFMA", universidadeIds: ["u1", "u2"], pontosEmbarqueIds: ["p1", "p2", "p3"] };
const valido: Formulario = {
  nome: "",
  ida,
  volta: voltaDaIda(ida),
  horarioIda: "06:30",
  horarioVolta: "17:30",
  temVolta: true,
  diasSemana: [1, 3, 5],
  motoristaId: "m1",
  onibusId: "o1",
  programar: true,
};

describe("volta coerente com a ida", () => {
  it("troca origem e destino, mantém as instituições e inverte os pontos", () => {
    expect(voltaDaIda(ida)).toEqual({
      origem: "UFMA",
      destino: "Centro",
      universidadeIds: ["u1", "u2"],
      pontosEmbarqueIds: ["p3", "p2", "p1"],
    });
  });

  it("não altera a ida (cópia independente)", () => {
    const volta = voltaDaIda(ida);
    volta.universidadeIds.push("u9");
    expect(ida.universidadeIds).toEqual(["u1", "u2"]);
  });
});

describe("validação do formulário da viagem", () => {
  it("aceita a viagem completa", () => {
    expect(validarFormulario(valido)).toBeNull();
  });

  it.each([
    [{ ida: { ...ida, origem: "" } }, "Informe a origem da ida."],
    [{ volta: { ...voltaDaIda(ida), destino: "X" } }, "Informe o destino da volta."],
    [{ volta: { ...voltaDaIda(ida), universidadeIds: [] } }, "Adicione ao menos uma instituição na volta."],
    [{ horarioIda: "6:30" }, "Informe o horário de saída da ida (HH:MM)."],
    [{ horarioVolta: "06:00" }, "O horário da volta deve ser depois do horário da ida."],
    [{ diasSemana: [] }, "Escolha ao menos um dia da semana."],
    [{ motoristaId: null }, "Selecione o motorista."],
  ])("aponta o problema %#", (mudanca, mensagem) => {
    expect(validarFormulario({ ...valido, ...mudanca })).toBe(mensagem);
  });

  it("sem volta, o horário da volta não é exigido", () => {
    expect(validarFormulario({ ...valido, temVolta: false, horarioVolta: "" })).toBeNull();
  });

  it("pontos de embarque são opcionais", () => {
    expect(validarFormulario({ ...valido, ida: { ...ida, pontosEmbarqueIds: [] } })).toBeNull();
  });

  it("salvando só a rota, ônibus, motorista e horários não são exigidos", () => {
    expect(validarFormulario({ ...valido, programar: false, motoristaId: null, onibusId: null, horarioIda: "" })).toBeNull();
  });
});

describe("formulário inicial", () => {
  const trecho = (origem: string, destino: string) => ({
    sentido: "IDA" as const,
    origem,
    destino,
    instituicoes: [{ id: "a", ordem: 1, universidadeId: "u1", universidade: { id: "u1", nome: "UFMA" } }],
    pontosEmbarque: [{ id: "b", ordem: 1, pontoEmbarqueId: "p1", pontoEmbarque: { id: "p1", nome: "Praça" } }],
  });
  const rota = {
    id: "r1",
    nome: "Centro ↔ UFMA",
    trechos: { ida: trecho("Centro", "UFMA"), volta: trecho("UFMA", "Centro") },
  } as unknown as Rota;

  it("viagem nova: vazia, dias úteis, programando", () => {
    const f = formularioInicial(undefined, undefined, false);
    expect(f).toMatchObject({ nome: "", diasSemana: [1, 2, 3, 4, 5], programar: true, temVolta: true });
  });

  it("rota dos cadastros sem programação: não programa por padrão", () => {
    const f = formularioInicial(rota, undefined, true);
    expect(f.programar).toBe(false);
    expect(f.ida).toEqual({ origem: "Centro", destino: "UFMA", universidadeIds: ["u1"], pontosEmbarqueIds: ["p1"] });
    expect(f.volta.origem).toBe("UFMA");
  });

  it("viagem programada sem volta: temVolta desligado", () => {
    const programacao = {
      horarioIda: "07:00",
      horarioVolta: null,
      diasSemana: [1],
      motoristaId: "m",
      onibusId: "o",
    } as unknown as Programacao;
    expect(formularioInicial(rota, programacao, true)).toMatchObject({ temVolta: false, programar: true, horarioIda: "07:00" });
  });
});
