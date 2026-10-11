import {
  diaISO,
  diaMes,
  formatarDiaBR,
  formatarDuracao,
  listarDias,
  mascararDia,
  mascararHora,
  minutosAte,
  parseDiaBR,
  somarDias,
  tempoRelativo,
} from "../datas";

describe("datas de calendário", () => {
  it("diaISO e formatarDiaBR convertem entre AAAA-MM-DD e DD/MM/AAAA", () => {
    expect(diaISO(new Date(2026, 8, 5, 23, 59))).toBe("2026-09-05");
    expect(formatarDiaBR("2026-09-05")).toBe("05/09/2026");
    expect(formatarDiaBR("2026-09-05T12:00:00.000Z")).toBe("05/09/2026");
  });

  it("somarDias atravessa mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("parseDiaBR recusa datas que não existem", () => {
    expect(parseDiaBR(" 29/02/2028 ")).toBe("2028-02-29");
    expect(parseDiaBR("29/02/2027")).toBeNull();
    expect(parseDiaBR("31/04/2026")).toBeNull();
    expect(parseDiaBR("2026-04-10")).toBeNull();
  });
});

describe("máscaras enquanto digita", () => {
  it.each([
    ["2", "2"],
    ["251", "25/1"],
    ["25092026", "25/09/2026"],
    ["25/09/20261999", "25/09/2026"],
  ])("dia %j → %j", (entrada, saida) => {
    expect(mascararDia(entrada)).toBe(saida);
  });

  it.each([
    ["6", "6"],
    ["063", "06:3"],
    ["0630", "06:30"],
    ["06:300", "06:30"],
  ])("hora %j → %j", (entrada, saida) => {
    expect(mascararHora(entrada)).toBe(saida);
  });
});

describe("tempo", () => {
  afterEach(() => jest.useRealTimers());

  it("tempoRelativo: agora, minutos, horas, ontem e data", () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 11, 12, 0) });
    const ha = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    expect(tempoRelativo(ha(0))).toBe("agora");
    expect(tempoRelativo(ha(5))).toBe("há 5 min");
    expect(tempoRelativo(ha(130))).toBe("há 2 h");
    expect(tempoRelativo(ha(30 * 60))).toBe("ontem");
    expect(tempoRelativo(ha(5 * 24 * 60))).toBe("06/10");
  });

  it("minutosAte conta até a saída (negativo se já passou)", () => {
    const agora = new Date(2026, 9, 11, 6, 0);
    expect(minutosAte("2026-10-11", "06:45", agora)).toBe(45);
    expect(minutosAte("2026-10-11", "05:30", agora)).toBe(-30);
    expect(minutosAte("2026-10-12", "06:00", agora)).toBe(24 * 60);
  });

  it("formatarDuracao", () => {
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(120)).toBe("2h");
    expect(formatarDuracao(135)).toBe("2h15");
  });

  it("diaMes usa o fuso do aparelho", () => {
    expect(diaMes(new Date(2026, 8, 29, 22, 0).toISOString())).toBe("29/09");
  });
});

describe("dias da semana", () => {
  it("listarDias ordena, remove repetidos e junta com 'e'", () => {
    expect(listarDias([5, 1, 3, 1])).toBe("Seg, Qua e Sex");
    expect(listarDias([0])).toBe("Dom");
    expect(listarDias([])).toBe("");
  });
});
