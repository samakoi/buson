import { describe, expect, it } from "vitest";
import { routes } from "../routes";
import { caminhoOpenApi, gerarOpenApi } from "./openapi";
import { inventariarRotas } from "./inventario";
import { documentacaoDasRotas } from "./rotas";

const inventario = inventariarRotas(routes);
const chaves = inventario.map((r) => `${r.metodo.toUpperCase()} ${caminhoOpenApi(r.caminho)}`);

describe("documentação da API", () => {
  it("toda rota tem descrição em docs/rotas.ts", () => {
    expect(chaves.filter((c) => !documentacaoDasRotas[c])).toEqual([]);
  });

  it("não há descrição de rota que não existe mais", () => {
    expect(Object.keys(documentacaoDasRotas).filter((c) => !chaves.includes(c))).toEqual([]);
  });

  it("gera um OpenAPI 3.0 com login exigido onde a API exige", () => {
    const doc = gerarOpenApi(routes, "teste");
    const op = (caminho: string, metodo: string) => (doc.paths[caminho] as Record<string, { security?: unknown[] }>)[metodo];
    expect(doc.openapi).toBe("3.0.3");
    expect(op("/auth/login", "post").security).toEqual([]);
    expect(op("/universidades", "get").security).toEqual([]);
    expect(op("/alunos/{id}", "get").security).toEqual([{ bearer: [] }]);
    // Link assinado: público, mesmo num módulo em que o resto exige login
    expect(op("/documentos/{id}/arquivo", "get").security).toEqual([]);
  });

  it("o inventário lê as permissões do router.use e da própria rota", () => {
    const rota = (metodo: string, caminho: string) => inventario.find((r) => r.metodo === metodo && r.caminho === caminho);
    expect(rota("get", "/onibus/status")).toMatchObject({ autenticada: true, permissoes: [] });
    expect(rota("post", "/onibus")).toMatchObject({ autenticada: true, permissoes: ["frota:gerenciar"] });
    expect(rota("post", "/viagens/:id/embarque/scan")).toMatchObject({ autenticada: true, permissoes: ["embarque:escanear"] });
  });
});
