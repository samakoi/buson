# Como contribuir

## Fluxo

1. Crie um branch a partir do branch base da etapa (ex.: `fase-11-<assunto>`). Nunca faça commit direto no `main`.
2. Faça commits pequenos, em português, no imperativo e com o assunto na frente: `API: ...`, `App: ...`, `Site: ...`,
   `deploy: ...`, `GUIA: ...`. O corpo explica o porquê quando não for óbvio.
3. Antes de abrir o PR, rode os comandos da seção abaixo nos projetos que você mudou.
4. Abra o PR com o CI verde. Mudança de comportamento passa pelo **staging** antes do merge
   ([docs/deploy.md](./docs/deploy.md#3-atualizar-uma-versão)).
5. Registre a mudança em [CHANGELOG.md](./CHANGELOG.md) (seção "Não lançado").

## Conferências (as mesmas do CI)

```bash
# API
cd backend
npm run format:check && npm run typecheck && npm run lint && npm test
npm run build && npm run test:e2e        # precisa do MySQL local (docs/desenvolvimento.md)

# App
cd mobile
npm run format:check && npm run typecheck && npm run lint && npm test
npx expo-doctor
```

`npm run format` corrige a formatação. O editor deve seguir o [`.editorconfig`](./.editorconfig) (LF, 2 espaços,
UTF-8; scripts `.ps1` em CRLF).

## Padrões de código

- **Idioma**: nomes, comentários e mensagens em português, como o resto do código.
- **Comentários** explicam o porquê, não o que a linha faz.
- **API**: siga o roteiro de [docs/api.md › Como adicionar uma rota](./docs/api.md#como-adicionar-uma-rota) (schema zod
  exportado, `exigir()`, `AppError` do catálogo, entrada em `docs/rotas.ts`, paginação em listas que crescem).
- **App**: telas em `src/features/<assunto>/`, dados por hooks do React Query no `api.ts` do assunto, componentes e
  tokens do design system, textos de status de `utils/rotulos.ts` ([docs/app.md](./docs/app.md)).
- **Dependências do app**: instale com `npx expo install <pacote>` para pegar a versão compatível com o SDK.
  Biblioteca com código nativo exige APK novo.
- **Decisões de arquitetura** novas viram um ADR em [docs/adr/](./docs/adr).

## Segurança

- **Nunca** versione `.env`, `deploy/.env.*`, `google-services.json` nem chaves: o repositório é público.
- Variáveis `EXPO_PUBLIC_*` vão para dentro do app; não ponha segredos nelas.
- Dados de teste em bancos compartilhados levam o prefixo `TST` e são apagados depois.
- Encontrou uma falha de segurança? Avise o responsável em particular, não abra issue pública.
