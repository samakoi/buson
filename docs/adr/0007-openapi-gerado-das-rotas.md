# 0007. OpenAPI gerado das rotas do Express e dos schemas zod

- Status: Aceito
- Data: 2026-10-11

## Contexto

A API tem cerca de 90 rotas e não tinha referência além do código. Escrever um OpenAPI à mão desatualiza rápido;
migrar as rotas para um framework que gera documentação seria uma mudança grande.

## Decisão

- Listar as rotas lendo a pilha do próprio Express (`docs/inventario.ts`), incluindo se exigem login e quais
  permissões (`exigir()` expõe a lista; `montar()` registra o caminho dos sub-roteadores).
- Usar os **mesmos schemas zod** da validação para descrever corpo e consulta (`@asteasolutions/zod-to-openapi`).
- Resumo de cada rota em `docs/rotas.ts`; um teste falha se alguma rota existir sem descrição ou vice-versa.
- Servir `/api/v1/openapi.json` e o Swagger UI em `/api/v1/docs` em desenvolvimento e staging; desligado em produção.

## Consequências

- A documentação acompanha o código: rota nova sem descrição quebra o CI.
- As respostas aparecem só como o envelope `{ data }` (os serviços devolvem objetos do Prisma, sem schema de saída).
  Descrever as saídas fica para quando houver necessidade (ex.: clientes externos).
- O inventário lê uma parte interna do Express 4 (`router.stack`); a migração para o Express 5 deve conferir o teste.
