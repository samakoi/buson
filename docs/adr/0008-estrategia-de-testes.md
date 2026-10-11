# 0008. Testes: unitários (Vitest / jest-expo) + E2E da API

- Status: Aceito
- Data: 2026-10-11

## Contexto

Até a fase 9 os testes eram só E2E da API (suítes que sobem a API contra um MySQL próprio). Eles cobrem os fluxos, mas
são lentos para regras pequenas e não alcançam o app.

## Decisão

- **API**: Vitest para regras puras (`*.test.ts` ao lado do código): datas, permissões, links assinados, formatos de
  arquivo, validações zod, auditoria, GPS e a completude da documentação. O `tsconfig.build.json` deixa os testes fora
  do `dist/`.
- **App**: jest-expo (recomendação da Expo) para utilitários e serviços (`__tests__/*-test.ts`), sem testes de tela
  por enquanto.
- **E2E da API** continuam sendo a rede de segurança das regras com banco (vagas, concorrência, faltas, push, GPS).
- Tudo roda no CI em cada push e PR.

## Consequências

- Regras puras são conferidas em segundos, sem banco.
- Testes de tela (React Native Testing Library) e de ponta a ponta no app ficam para uma fase futura.
- Regra que mexe no banco continua precisando de E2E; o padrão "unitário quando puro, E2E quando envolve banco" está
  em `docs/api.md`.
