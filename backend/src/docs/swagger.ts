import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { gerarOpenApi } from "./openapi";

/**
 * Documentação navegável da API (fora da produção):
 *   GET /api/v1/openapi.json  → documento OpenAPI 3.0
 *   GET /api/v1/docs          → Swagger UI (permite testar as rotas com um token)
 */
export function rotasDaDocumentacao(raiz: Router) {
  const docs = Router();
  let documento: ReturnType<typeof gerarOpenApi> | null = null;

  // Gerado na primeira visita: as rotas não mudam com o servidor rodando
  docs.get("/openapi.json", (_req, res) => {
    documento ??= gerarOpenApi(raiz, process.env.APP_VERSAO || "dev");
    res.json(documento);
  });
  docs.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: "Bus On API",
      // validatorUrl: null → sem o selo do validador externo (a CSP bloquearia a imagem)
      swaggerOptions: { url: "/api/v1/openapi.json", validatorUrl: null, persistAuthorization: false },
    })
  );
  return docs;
}
