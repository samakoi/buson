import { formatarDistancia, formatarTamanho, formatarTelefone, haQuantoTempo, mascararTelefone } from "../formatos";

describe("telefone", () => {
  it.each([
    ["", ""],
    ["9", "(9"],
    ["9998", "(99) 98"],
    ["9932221234", "(99) 3222-1234"],
    ["99981234567", "(99) 98123-4567"],
    ["(99) 98123-45678", "(99) 98123-4567"],
  ])("máscara %j → %j", (entrada, saida) => {
    expect(mascararTelefone(entrada)).toBe(saida);
  });

  it("sem telefone mostra um traço", () => {
    expect(formatarTelefone(null)).toBe("—");
    expect(formatarTelefone("99981234567")).toBe("(99) 98123-4567");
  });
});

describe("tamanhos, distâncias e tempo", () => {
  it("formatarTamanho com vírgula decimal", () => {
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(1536)).toBe("1,5 KB");
    expect(formatarTamanho(2_400_000)).toBe("2,3 MB");
  });

  it("formatarDistancia arredonda metros de 10 em 10 e passa a km a partir de 1000", () => {
    expect(formatarDistancia(347)).toBe("350 m");
    expect(formatarDistancia(999)).toBe("1000 m");
    expect(formatarDistancia(2340)).toBe("2,3 km");
  });

  it("haQuantoTempo", () => {
    expect(haQuantoTempo(45)).toBe("há 45 s");
    expect(haQuantoTempo(190)).toBe("há 3 min");
    expect(haQuantoTempo(7200)).toBe("há 2 h");
  });
});
