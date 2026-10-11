import { codigoDeErro, mensagemDeErro } from "../feedback";
import { mudancaAuditoria, rotuloValorAuditoria, situacaoDaFalta } from "../rotulos";

describe("situacaoDaFalta", () => {
  it("falta registrada depende de haver justificativa", () => {
    expect(situacaoDaFalta({ status: "REGISTRADA", justificativa: null })).toBe("SEM_JUSTIFICATIVA");
    expect(situacaoDaFalta({ status: "REGISTRADA", justificativa: "Consulta médica" })).toBe("AGUARDANDO_DECISAO");
  });

  it("decisões da administração passam direto", () => {
    expect(situacaoDaFalta({ status: "JUSTIFICADA", justificativa: "x" })).toBe("JUSTIFICADA");
    expect(situacaoDaFalta({ status: "INDEFERIDA", justificativa: "x" })).toBe("INDEFERIDA");
  });
});

describe("auditoria em texto", () => {
  it("rotuloValorAuditoria traduz status conhecidos e mantém o resto", () => {
    expect(rotuloValorAuditoria("ATIVO")).toBe("Ativo");
    expect(rotuloValorAuditoria("REPROVADO")).toBe("Reprovado");
    expect(rotuloValorAuditoria("REGISTRADA")).toBe("Registrada");
    expect(rotuloValorAuditoria("UFMA")).toBe("UFMA");
    expect(rotuloValorAuditoria(null)).toBe("");
    expect(rotuloValorAuditoria(3)).toBe("3");
  });

  it("mudancaAuditoria resume o antes → depois", () => {
    expect(mudancaAuditoria({ valorAnterior: { statusConta: "PENDENTE" }, valorNovo: { statusConta: "ATIVO" } })).toBe("Pendente → Ativo");
    expect(mudancaAuditoria({ valorAnterior: null, valorNovo: { documento: "PENDENTE" } })).toBe("Aguardando análise");
    expect(mudancaAuditoria({ valorAnterior: { documento: "PENDENTE" }, valorNovo: { documento: "EM_ANALISE" } })).toBe(
      "Aguardando análise → Em análise"
    );
    expect(mudancaAuditoria({ valorAnterior: { dias: ["Seg", "Qua"] }, valorNovo: { dias: [{ dia: "Ter" }] } })).toBe("Seg, Qua → Ter");
    expect(mudancaAuditoria({ valorAnterior: { dias: [] }, valorNovo: { dias: ["Sex"] } })).toBe("nenhum → Sex");
    expect(mudancaAuditoria({ valorAnterior: { dias: ["Seg"], rota: "Centro" }, valorNovo: {} })).toBe("Seg (Centro)");
    expect(mudancaAuditoria({ valorAnterior: { nome: "a" }, valorNovo: { nome: "b" } })).toBe("");
  });
});

describe("erros da API", () => {
  const erroDaApi = { response: { data: { error: { code: "VIAGEM_ENCERRADA", message: "A viagem já foi encerrada." } } } };

  it("usa a mensagem e o código da API quando existem", () => {
    expect(mensagemDeErro(erroDaApi, "padrão")).toBe("A viagem já foi encerrada.");
    expect(codigoDeErro(erroDaApi)).toBe("VIAGEM_ENCERRADA");
  });

  it("sem internet explica o problema; outros casos usam o texto padrão", () => {
    expect(mensagemDeErro({ message: "Network Error" }, "padrão")).toMatch(/Sem conexão/);
    expect(mensagemDeErro(new Error("x"), "padrão")).toBe("padrão");
    expect(mensagemDeErro(undefined, "padrão")).toBe("padrão");
    expect(codigoDeErro(undefined)).toBeUndefined();
  });
});
