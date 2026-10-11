# App (Android e base do site)

O app fica em [`mobile/`](../mobile): Expo SDK 57 com React Native. O mesmo código gera o APK Android e o site
([site.md](./site.md)).

## Organização

- **`src/features/<assunto>/`**: as telas de um assunto e o `api.ts` com os hooks de dados dele. Assuntos: `auth`,
  `alunos`, `viagens`, `alocacao`, `embarque`, `documentos`, `faltas`, `gps`, `avisos`, `push`, `cadastros`,
  `dashboard`, `atualizacao` e `web`.
- **`src/components/`**: o design system. Use sempre estes componentes (`Tela`, `Cabecalho`, `Card`, `Botao`,
  `Campo`, `Folha`, `Pilula`, `Chips`, `EstadoVazio`...) e os tokens de [`theme/tokens.ts`](../mobile/src/theme/tokens.ts),
  em vez de cores e tamanhos soltos. Os textos de status vêm de [`utils/rotulos.ts`](../mobile/src/utils/rotulos.ts).
- **`src/navigation/`**: uma barra de abas por perfil. O `RootNavigator` carrega só as abas do perfil logado (no site,
  cada perfil é um arquivo JS separado).
- **Arquivos `.web.tsx`** substituem a versão nativa no site (mapa Leaflet, moldura, página de instalação).

## Dados do servidor (TanStack Query)

Toda busca de dados passa pelo React Query. Cada assunto declara as **chaves de cache** e os **hooks** no seu
`api.ts`:

```ts
// features/alunos/api.ts
export const chavesAluno = {
  eu: ["alunos", "me"] as const,
  perfil: (alunoId: string) => ["alunos", "perfil", alunoId] as const,
};

export function useMeusDados() {
  return useQuery({ queryKey: chavesAluno.eu, queryFn: async () => (await api.get<MeusDados>("/alunos/me")).data });
}
```

Na tela, [`useDadosDaTela`](../mobile/src/hooks/useDadosDaTela.ts) junta o comportamento padrão:

```tsx
const meusDados = useMeusDados();
const { carregando, atualizando, atualizar } = useDadosDaTela(meusDados, { intervaloMs: 30_000 });
// carregando: spinner da primeira carga; atualizar: "puxar para atualizar"
// recarrega ao voltar para a tela e, com intervaloMs, a cada intervalo enquanto ela está visível
```

Regras:

- Depois de salvar algo, **invalide** as chaves afetadas (`queryClient.invalidateQueries({ queryKey: chavesAluno.eu })`)
  ou atualize o cache com `setQueryData`. Assim todas as telas que mostram aquele dado se atualizam.
- Listas paginadas usam `useInfiniteQuery` (ex.: `useListaAlunos`) e `placeholderData: keepPreviousData` para não
  piscar ao trocar o filtro.
- No celular, voltar ao app conta como foco (`focusManager` ligado ao `AppState` em
  [`services/queryClient.ts`](../mobile/src/services/queryClient.ts)).
- Escritas (POST/PATCH) chamam `api` direto e tratam o erro com `mensagemDeErro(err, "texto padrão")`.

## Histórico de viagens (administração)

Na aba **Viagens › Histórico** ([`HistoricoViagens.tsx`](../mobile/src/features/viagens/HistoricoViagens.tsx)): os mesmos
períodos do Dashboard ([`utils/periodos.ts`](../mobile/src/utils/periodos.ts)), filtros numa folha e a lista paginada.
Tocar numa viagem abre [`DetalheViagemScreen`](../mobile/src/features/viagens/DetalheViagemScreen.tsx), com o trajeto
no mapa quando houve GPS.

## Sessão e armazenamento

- [`services/api.ts`](../mobile/src/services/api.ts): axios com o token, desembrulha o `{ data }` e renova a sessão
  sozinho ao receber 401.
- [`services/tokens.ts`](../mobile/src/services/tokens.ts): no celular os tokens ficam no **SecureStore**
  (Keystore/Keychain, fora do backup do Android); no site, no `localStorage`. Versões antigas guardavam no
  AsyncStorage e são migradas na primeira abertura, sem novo login.
- [`store/sessao.ts`](../mobile/src/store/sessao.ts): usuário logado (Zustand), login e logout.
- AsyncStorage só para dados não sensíveis (usuário em cache, fila de GPS offline, preferências).

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `EXPO_PUBLIC_API_URL` | endereço da API (`.../api/v1`); nos builds vem do `eas.json` |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry do app (opcional; no EAS, em *Environment variables*) |
| `EXPO_PUBLIC_MAPA_TILES` | servidor de mapas alternativo (padrão: OpenStreetMap) |
| `APP_VARIANT=staging` | gera o "Bus On Teste" (pacote `com.buson.app.staging`, ícone laranja) |

Tudo que começa com `EXPO_PUBLIC_` vai para dentro do app: **nunca** coloque segredos nessas variáveis.

## Push no celular (EAS + Firebase)

A API envia os avisos pelo **Expo Push** (fila, vários aparelhos por usuário, descarte de tokens inválidos). O push não
funciona no Expo Go do Android, no emulador nem no site: nesses casos os avisos ficam só na aba Avisos.

1. **Projeto EAS** (já feito: `@pedropinho/bus-on`). O `projectId` fica no `app.json` e não é segredo.
2. **Firebase** (https://console.firebase.google.com):
   - adicione dois apps Android, `com.buson.app` e `com.buson.app.staging`, e baixe o `google-services.json`
     (**fora do git**: o repositório é público);
   - em *Configurações do projeto › Contas de serviço*, gere uma chave privada e guarde fora do projeto.
3. **EAS** (expo.dev › projeto):
   - *Environment variables*: crie `GOOGLE_SERVICES_JSON` do tipo **File**, visibilidade **Secret**, em `preview` e
     `production`;
   - *Credentials › Android*: em cada pacote, envie a chave em *FCM V1 service account key*.
4. **API**: `PUSH_MODO=expo`. Lembretes: `LEMBRETE_VESPERA_HORARIO` (padrão 20:00) e `LEMBRETE_SAIDA_MINUTOS`
   (padrão 60).

Cada usuário escolhe em *Avisos › ⚙* se quer lembretes e avisos de vaga no celular. Cadastro, documentos, faltas e
viagem cancelada sempre chegam.

## GPS e mapa

- **Motorista**: ao iniciar a viagem, o app compartilha a posição até encerrar. No APK, com **"Permitir o tempo todo"**,
  continua com a tela apagada (notificação fixa). Sem internet, as leituras ficam numa fila e vão em lote depois.
- **Aluno**: *Início › Ver onde está o ônibus*, só na viagem em que tem vaga e enquanto ela está em andamento. A
  distância usa as coordenadas cadastradas em *Cadastros › Pontos* e *Universidades*.
- **Administração**: *Dashboard › Ver ônibus no mapa (ao vivo)*.
- Mapa: OpenStreetMap (Leaflet), sem chave.

## APK Android

| | Bus On (oficial) | Bus On Teste |
|---|---|---|
| Pacote | `com.buson.app` | `com.buson.app.staging` |
| API | `https://api.onbus.online` | `https://api-staging.onbus.online` |
| Perfil (`eas.json`) e canal | `production` | `staging` |

```bash
npm run build:staging     # Bus On Teste
npm run build:producao    # Bus On
```

O build roda na nuvem do Expo (10 a 20 minutos) e termina com um link para baixar o APK. Um build sem endereço
`https://` é recusado antes de começar. Cada build ganha um `versionCode` novo.

**Guarde uma cópia da chave de assinatura**: `npx eas-cli credentials` › Android › *Keystore* › *Download*, para os
dois perfis. Sem ela, nenhum APK novo atualiza o app instalado.

### Atualizações

- **Só código JavaScript** (telas, textos, regras do app): chega pela internet, sem reinstalar.

  ```bash
  npm run atualizacao -- staging "Corrige o texto da tela de faltas"
  npm run atualizacao -- producao "Corrige o texto da tela de faltas"
  ```

  O app procura ao abrir e ao voltar para a tela; a versão nova vale na próxima abertura (ou na hora, pelo menu da
  conta › *Procurar atualização*). Publique no staging, teste e só depois na produção.
- **Mudança nativa** (biblioteca com código nativo, permissão, plugin, versão do Expo): exige **APK novo**. A
  atualização pela internet só chega a APKs com o mesmo código nativo (`runtimeVersion` por fingerprint). Depois de
  distribuir o APK, defina no servidor `APP_VERSAO_MINIMA_ANDROID` (o build novo) e `APP_LINK_ANDROID` e rode
  `atualizar.ps1 -Forcar`: quem tiver APK antigo vê a tela "Atualize o Bus On".

### Roteiro de teste de um APK novo

No Bus On Teste, com a API de staging: login dos três perfis; QR de embarque pela câmera; envio de documento (foto e
PDF); push chegando com o app fechado; GPS com a tela apagada; mapa ao vivo; versão no menu da conta. Só depois gere o
APK oficial.
