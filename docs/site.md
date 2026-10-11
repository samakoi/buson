# Site (PWA)

O mesmo app roda no navegador em `https://app.onbus.online` (teste: `https://app-staging.onbus.online`). Funciona em
iPhone, Android e computador e pode ser **instalado** pelo navegador: ganha ícone na tela inicial e abre em tela cheia,
sem loja. A página `/instalar` explica o passo a passo para os alunos.

| | Site (PWA) | APK Android |
|---|---|---|
| Quem usa | todos os perfis, em qualquer aparelho | Android |
| GPS do motorista | só com a tela aberta (ela fica acesa durante a viagem) | também com a tela apagada |
| Avisos no celular | ainda não (aparecem na aba Avisos) | sim (push) |
| Atualização | a última versão ao abrir | pela internet ([app.md](./app.md#atualizações)) |

## Como é montado

```bash
cd mobile
npm run build:web -- producao     # ou staging
```

O script [`scripts/build-web.mjs`](../mobile/scripts/build-web.mjs) roda `expo export -p web` e gera `mobile/dist`:

- usa o endereço da API do perfil correspondente no `eas.json` (o mesmo do APK);
- no staging, o nome vira "Bus On Teste" com a cor laranja;
- grava o manifest e o `_headers` com a política de segurança (CSP): o site só carrega código dele, mais o Leaflet
  (mapa, conferido por hash SRI), o leitor de QR para iPhone e o contador de visitas do Cloudflare;
- os arquivos com hash ficam em cache por 1 ano; a página sempre confere se há versão nova.

O Cloudflare Pages não publica pastas chamadas `node_modules`: o script move as fontes e imagens das bibliotecas
(`assets/node_modules`) para `assets/pacotes`, corrige os caminhos e falha se algo continuar lá.

Desempenho: só o Ionicons entra no pacote e as abas de cada perfil são arquivos separados, carregados depois do login.

Para testar no computador contra a API local:

```bash
npm run build:web -- staging --api http://localhost:3333/api/v1
```

e sirva a pasta `dist` com qualquer servidor estático. A origem desse servidor precisa estar em `CORS_ORIGINS`.

## Publicação (Cloudflare Pages)

São dois projetos **Pages** (não Worker), um por ambiente, ligados ao repositório. Cada push no branch do projeto
publica o site em cerca de 1 minuto.

> No painel, o botão **Create** abre a criação de **Worker** (campo *Deploy command*). Esse caminho está errado: use
> *Pages › Import an existing Git repository*. A tela certa tem **Framework preset** e **Build output directory**.

| Campo | Teste (staging) | Produção |
|---|---|---|
| Projeto | `buson` (`buson-608.pages.dev`) | `buson-web` (a criar) |
| Production branch | o branch em teste | `main` |
| Framework preset | None | None |
| Build command | `cd mobile && npm ci && npm run build:web -- staging` | `cd mobile && npm ci && npm run build:web -- producao` |
| Build output directory | `mobile/dist` | `mobile/dist` |
| Custom domain | `app-staging.onbus.online` | `app.onbus.online` |

Depois do primeiro build com **Success**: *Custom domains › Set up a custom domain › Activate domain*. Se o domínio
responder "Hello world", ele está preso a um Worker criado por engano: apague o Worker e o registro DNS do tipo
*Worker* com o mesmo nome, e clique em **Retry** no projeto Pages.

A API de cada ambiente precisa aceitar o seu site em `CORS_ORIGINS` (arquivo de ambiente do servidor) e ser atualizada
com `atualizar.ps1 -Ambiente <ambiente> -Forcar`.
