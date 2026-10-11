import { describe, expect, it } from "vitest";
import { requisitosFaltando, senhaForte } from "./senha";

describe("regra de senha forte", () => {
  it.each(["Onibus@2026", "Bus0n!seguro", "Çaminho#9", "Tst@2026bus"])("aceita %j", (senha) => {
    expect(senhaForte.safeParse(senha).success).toBe(true);
  });

  it.each([
    ["123456", ["pelo menos 8 caracteres", "uma letra maiúscula", "uma letra minúscula", "um caractere especial (ex.: ! @ # $ %)"]],
    ["onibus@2026", ["uma letra maiúscula"]],
    ["ONIBUS@2026", ["uma letra minúscula"]],
    ["Onibus@onibus", ["um número"]],
    ["Onibus2026", ["um caractere especial (ex.: ! @ # $ %)"]],
    ["On@1", ["pelo menos 8 caracteres"]],
  ])("%j: aponta só o que falta", (senha, faltando) => {
    expect(requisitosFaltando(senha)).toEqual(faltando);
  });

  it("espaço não conta como caractere especial", () => {
    expect(requisitosFaltando("Onibus 2026")).toEqual(["um caractere especial (ex.: ! @ # $ %)"]);
  });

  it("a mensagem de erro lista os itens que faltam", () => {
    const r = senhaForte.safeParse("onibus2026");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("A senha precisa ter uma letra maiúscula e um caractere especial (ex.: ! @ # $ %).");
  });

  it("recusa mais de 72 caracteres (limite do bcrypt)", () => {
    expect(senhaForte.safeParse("Aa1!" + "x".repeat(69)).success).toBe(false);
    expect(senhaForte.safeParse("Aa1!" + "x".repeat(68)).success).toBe(true);
  });
});
