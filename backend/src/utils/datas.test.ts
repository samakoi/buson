import { describe, expect, it } from "vitest";
import { comHorario, diaMes, formatarDia, intervaloDeDias, lerDiasSemana, nomesDosDias, parseDia, somarDias } from "./datas";

describe("parseDia / formatarDia", () => {
  it("converte AAAA-MM-DD para meia-noite local e volta", () => {
    const d = parseDia("2026-02-28");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 28, 0]);
    expect(formatarDia(d)).toBe("2026-02-28");
  });

  it.each(["2026-02-30", "2026-13-01", "28/02/2026", "2026-2-8", ""])("recusa %j", (dia) => {
    expect(() => parseDia(dia)).toThrowError(expect.objectContaining({ codigo: "DATA_INVALIDA" }));
  });

  it("aceita 29/02 só em ano bissexto", () => {
    expect(formatarDia(parseDia("2028-02-29"))).toBe("2028-02-29");
    expect(() => parseDia("2027-02-29")).toThrow();
  });
});

describe("intervalos", () => {
  it("cobre o dia inteiro: [início, próximo dia)", () => {
    const { gte, lt } = intervaloDeDias(new Date(2026, 9, 11, 15, 30));
    expect(formatarDia(gte)).toBe("2026-10-11");
    expect(gte.getHours()).toBe(0);
    expect(formatarDia(lt)).toBe("2026-10-12");
  });

  it("vários dias, inclusive o último", () => {
    const { gte, lt } = intervaloDeDias(parseDia("2026-10-30"), parseDia("2026-11-01"));
    expect([formatarDia(gte), formatarDia(lt)]).toEqual(["2026-10-30", "2026-11-02"]);
  });

  it("somarDias atravessa mês e ano", () => {
    expect(formatarDia(somarDias(parseDia("2026-12-31"), 1))).toBe("2027-01-01");
    expect(formatarDia(somarDias(parseDia("2026-03-01"), -1))).toBe("2026-02-28");
  });
});

describe("dias da semana", () => {
  it("nomesDosDias ordena, remove repetidos e junta com 'e'", () => {
    expect(nomesDosDias([5, 1, 3, 1])).toBe("Seg, Qua e Sex");
    expect(nomesDosDias([2])).toBe("Ter");
    expect(nomesDosDias([])).toBe("");
  });

  it("lerDiasSemana descarta valores inválidos da coluna JSON", () => {
    expect(lerDiasSemana([3, 1, 1, 7, -1, 2.5, "4", null])).toEqual([1, 3]);
    expect(lerDiasSemana("1,2")).toEqual([]);
    expect(lerDiasSemana(null)).toEqual([]);
  });
});

describe("horários", () => {
  it("comHorario põe o horário no dia, ignorando a hora original", () => {
    const d = comHorario(new Date(2026, 9, 11, 23, 59), "06:45");
    expect([formatarDia(d), d.getHours(), d.getMinutes()]).toEqual(["2026-10-11", 6, 45]);
  });

  it("diaMes formata DD/MM", () => {
    expect(diaMes(parseDia("2026-09-05"))).toBe("05/09");
  });
});
