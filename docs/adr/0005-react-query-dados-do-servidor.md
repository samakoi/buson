# 0005. TanStack Query para os dados do servidor no app

- Status: Aceito
- Data: 2026-10-11

## Contexto

As telas buscavam dados de duas formas: parte com TanStack Query e parte com um hook próprio (`useCarregamento`) que
guardava o resultado em estado local. Telas que mostravam o mesmo dado buscavam de novo, e depois de salvar era
preciso lembrar de recarregar cada tela.

## Decisão

- Toda busca de dados usa **TanStack Query**. Cada assunto tem um `api.ts` com as chaves de cache e os hooks.
- `useDadosDaTela` padroniza o comportamento da tela: spinner só na primeira carga, puxar para atualizar, recarga ao
  voltar para a tela e intervalo opcional enquanto ela está visível.
- Depois de salvar, a tela invalida as chaves afetadas (ou ajusta o cache com `setQueryData`).
- Zustand fica só para a sessão.

## Consequências

- Um dado buscado numa tela já aparece nas outras; menos requisições e menos código repetido.
- Listas paginadas usam `useInfiniteQuery` com `keepPreviousData` (sem piscar ao trocar filtro).
- Quem cria uma tela nova precisa seguir o padrão (documentado em `docs/app.md`); `useCarregamento` foi removido.
