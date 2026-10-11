# 0001. API em Express + Prisma + MySQL, módulos por assunto

- Status: Aceito
- Data: 2026-09-28

## Contexto

O projeto começou como um MVP em Node.js com Express, Prisma e MySQL. A evolução (fases 0 a 9) acrescentou regras com
concorrência (vagas, lista de espera), arquivos, push, GPS e auditoria. Era preciso decidir entre manter a base ou
migrar para um framework mais opinativo (NestJS, Fastify) ou outro banco.

## Decisão

- Manter **Express 4 + TypeScript + Prisma 5 + MySQL 8**.
- Organizar por **assunto** (`src/modules/<assunto>/`), com `*.routes.ts` (HTTP e validação zod) e `*.service.ts`
  (regras e banco).
- Respostas padronizadas (`{ data }` / `{ error: { code, ... } }`) e catálogo único de códigos de erro.
- Permissões por ação (`exigir("alunos:ler")`), não por papel.
- Disputas por vaga em transação com `SELECT … FOR UPDATE`.

## Consequências

- Equipe pequena mantém uma pilha simples e conhecida; o Prisma dá migrations versionadas e tipos do banco.
- Express não valida nem documenta sozinho: a validação é feita com zod em cada rota, e a documentação é gerada à
  parte (ADR 0007).
- O MySQL atende ao volume previsto (algumas centenas de alunos). Travas de linha resolvem a concorrência sem fila
  externa.
