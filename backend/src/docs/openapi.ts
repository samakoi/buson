import { Router } from "express";
import { z } from "zod";
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { PERMISSOES_POR_PAPEL, Permissao } from "../auth/permissoes";
import { ERROS } from "../errors/catalogo";
import { inventariarRotas } from "./inventario";
import { documentacaoDasRotas } from "./rotas";

// Habilita .openapi() nos schemas (só para o campo de arquivo do multipart)
extendZodWithOpenApi(z);

/** "/alunos/:id" (Express) → "/alunos/{id}" (OpenAPI) */
export const caminhoOpenApi = (caminho: string) => caminho.replace(/:(\w+)/g, "{$1}");

const nomesDasTags: Record<string, string> = {
  auth: "Autenticação",
  viagens: "Viagens, check-in, embarque e GPS",
  universidades: "Cadastros",
  onibus: "Cadastros",
  rotas: "Cadastros",
  motoristas: "Cadastros",
  "pontos-embarque": "Cadastros",
  dashboard: "Dashboard",
  notificacoes: "Avisos e push",
  alunos: "Alunos",
  programacoes: "Programação semanal",
  documentos: "Documentos",
  faltas: "Faltas",
};

const papeisCom = (p: Permissao) =>
  Object.entries(PERMISSOES_POR_PAPEL)
    .filter(([, lista]) => lista.includes(p))
    .map(([papel]) => papel);

const respostaDeErro = z.object({
  error: z.object({
    code: z.enum(Object.keys(ERROS) as [keyof typeof ERROS, ...(keyof typeof ERROS)[]]),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string(),
  }),
});

/** Documento OpenAPI 3.0 gerado das rotas do Express + schemas zod que elas já usam para validar. */
export function gerarOpenApi(raiz: Router, versao: string) {
  const registro = new OpenAPIRegistry();
  const erro = registro.register("Erro", respostaDeErro);
  const bearer = registro.registerComponent("securitySchemes", "bearer", { type: "http", scheme: "bearer", bearerFormat: "JWT" });

  for (const rota of inventariarRotas(raiz)) {
    const caminho = caminhoOpenApi(rota.caminho);
    const doc = documentacaoDasRotas[`${rota.metodo.toUpperCase()} ${caminho}`];
    const nomesParametros = [...caminho.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const papeis = [...new Set(rota.permissoes.flatMap(papeisCom))];
    const acesso = !rota.autenticada
      ? "**Pública** (sem login)."
      : rota.permissoes.length
        ? `**Permissão:** ${rota.permissoes.join(" ou ")} (papéis: ${papeis.join(", ")}).`
        : "**Qualquer usuário logado.**";
    const status = doc?.status ?? 200;

    registro.registerPath({
      method: rota.metodo,
      path: caminho,
      tags: [nomesDasTags[rota.caminho.split("/")[1]] ?? "Geral"],
      summary: doc?.resumo ?? "(sem descrição)",
      description: [doc?.descricao, acesso].filter(Boolean).join("\n\n"),
      security: rota.autenticada ? [{ [bearer.name]: [] }] : [],
      request: {
        params: nomesParametros.length ? z.object(Object.fromEntries(nomesParametros.map((n) => [n, z.string()]))) : undefined,
        query: doc?.consulta,
        body: doc?.corpo
          ? { content: { "application/json": { schema: doc.corpo } } }
          : doc?.arquivo
            ? {
                content: {
                  "multipart/form-data": {
                    schema: (doc.arquivo.outros ?? z.object({})).extend({
                      [doc.arquivo.campo]: z.string().openapi({ type: "string", format: "binary" }),
                    }),
                  },
                },
              }
            : undefined,
      },
      responses: {
        [status]: {
          description: "Sucesso. O conteúdo vem sempre dentro de `data`.",
          content: { "application/json": { schema: z.object({ data: z.unknown() }) } },
        },
        default: { description: "Erro (código do catálogo em `error.code`)", content: { "application/json": { schema: erro } } },
      },
    });
  }

  return new OpenApiGeneratorV3(registro.definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Bus On API",
      version: versao,
      description: [
        "API do Bus On (transporte universitário). Todas as rotas ficam em `/api/v1`.",
        "",
        "- **Sucesso:** `{ data: ... }`",
        "- **Erro:** `{ error: { code, message, details?, requestId } }` — `code` é estável (veja o schema Erro).",
        "- **Autenticação:** `Authorization: Bearer <accessToken>` (15 min); renove com `POST /auth/refresh`.",
        "- **Datas:** dias como `AAAA-MM-DD`, horários como `HH:MM` (fuso do servidor).",
      ].join("\n"),
    },
    servers: [{ url: "/api/v1" }],
  });
}
