import { REQUISITOS_SENHA, senhaForte } from "../senha";

describe("regra de senha forte (igual à da API)", () => {
  it.each(["Onibus@2026", "Bus0n!seguro", "Çaminho#9"])("aceita %j", (senha) => {
    expect(senhaForte(senha)).toBe(true);
  });

  it.each(["123456", "onibus@2026", "ONIBUS@2026", "Onibus@onibus", "Onibus2026", "On@1", "Onibus 2026"])("recusa %j", (senha) => {
    expect(senhaForte(senha)).toBe(false);
  });

  it("marca cada requisito separadamente", () => {
    const cumpridos = REQUISITOS_SENHA.filter((r) => r.ok("onibus2026")).map((r) => r.texto);
    expect(cumpridos).toEqual(["Pelo menos 8 caracteres", "Uma letra minúscula", "Um número"]);
  });
});
