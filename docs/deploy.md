# Implantação e operação

A API roda em Docker numa máquina Windows e chega à internet pelo **Cloudflare Tunnel** (HTTPS, sem abrir portas no
roteador). Produção e staging são totalmente separados: cada um tem MySQL, documentos, backups, túnel e segredos
próprios. O site fica no Cloudflare Pages ([site.md](./site.md)) e o APK no EAS ([app.md](./app.md)).

```
Celular/site ──HTTPS──▶ Cloudflare ──túnel──▶ cloudflared ──▶ api (Node) ──▶ mysql
                                                               │
                                              backup diário ───┴──▶ pasta local + Cloudflare R2
```

| | Produção | Staging |
|---|---|---|
| Pasta do servidor | `C:\buson\producao` | `C:\buson\staging` |
| Arquivo de ambiente | `deploy\.env.producao` | `deploy\.env.staging` |
| API na própria máquina | `http://127.0.0.1:4000` | `http://127.0.0.1:4001` |
| Endereço público | `https://api.onbus.online` | `https://api-staging.onbus.online` |
| Swagger | desligado | `/api/v1/docs` |

O [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) tem os serviços `mysql`, `api`, `backup`, `restaurar`
(só sob demanda) e `cloudflared`. A imagem da API ([`backend/Dockerfile`](../backend/Dockerfile)) é montada em duas
etapas, roda como usuário sem privilégios e para de forma graciosa no `docker stop` (fecha conexões e o banco).

## 1. Pré-requisitos

- **Docker Desktop** com *Start Docker Desktop when you sign in* ligado.
- **Git**.
- Máquina sempre ligada: desative a suspensão em *Configurações › Sistema › Energia*.
- Domínio com DNS no Cloudflare.

Os scripts ficam em [`deploy/`](../deploy). Rode-os com `powershell -ExecutionPolicy Bypass -File <script> ...`, que
libera só aquela execução.

## 2. Instalação (uma vez por ambiente)

### 2.1 Cópia do repositório só para o servidor

Não use a pasta de desenvolvimento: o script de atualização troca o commit da pasta.

```bash
git clone https://github.com/samakoi/buson.git C:\buson\producao
git clone https://github.com/samakoi/buson.git C:\buson\staging
```

Nunca edite arquivos nessas pastas: com alteração local, o `atualizar.ps1` se recusa a rodar.

### 2.2 Segredos

```bash
cd C:\buson\producao
powershell -ExecutionPolicy Bypass -File .\deploy\gerar-segredos.ps1 -Ambiente producao
notepad .\deploy\.env.producao
```

O script cria o arquivo com `JWT_SECRET` e senhas do MySQL aleatórios (staging gera outros). Complete os itens 2.3 a
2.5 e **guarde uma cópia num gerenciador de senhas**. O arquivo nunca vai para o git.

### 2.3 Cloudflare Tunnel

1. *Zero Trust › Networks › Tunnels › Create a tunnel › Cloudflared*, nome `buson-producao`.
2. Copie **só o token** (o texto depois de `--token`) para `TUNNEL_TOKEN=`. Não instale nada: o `cloudflared` já está
   no compose.
3. *Public Hostname*: subdomínio `api`, tipo `HTTP`, URL `api:3333`.
4. Staging: outro túnel (`buson-staging`), hostname `api-staging`, mesmo serviço.

Mantenha `TRUST_PROXY=1`. Em `CORS_ORIGINS`, liste só o site do ambiente (`https://app.onbus.online` ou
`https://app-staging.onbus.online`); o APK não usa CORS.

**Ajustes no Cloudflare** (domínio `onbus.online`):

- *SSL/TLS › Edge Certificates*: **Always Use HTTPS** e **Minimum TLS Version** 1.2.
- *Security › WAF › Rate limiting rules*: regra "login" para *URI Path* começando com `/api/v1/auth/`, mais de 30
  requisições por minuto pelo mesmo IP, ação *Block* por 10 minutos.
- *Security › Bots*: **Bot Fight Mode desligado** (ele bloqueia o app).
- *Notifications*: **Tunnel Health Alert** para o seu e-mail.

### 2.4 Cloudflare R2 (cópia dos backups)

1. *R2 › Create bucket* `buson-backups` (os dois ambientes usam pastas `production/` e `staging/`).
2. *Manage R2 API Tokens › Create API token*, permissão *Object Read & Write* só nesse bucket.
3. Preencha `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET=buson-backups`.

### 2.5 Monitoramento

- **Sentry**: projeto *Node.js* para a API (`SENTRY_DSN`) e *React Native* para o app (`EXPO_PUBLIC_SENTRY_DSN` no
  EAS). Nenhum dos dois envia dados pessoais.
- **UptimeRobot**: monitor HTTP(s) em `https://api.onbus.online/api/v1/saude` a cada 5 minutos. Só responde "ok" se
  API **e** banco estiverem funcionando.

### 2.6 Primeira subida

```bash
cd C:\buson\producao
powershell -ExecutionPolicy Bypass -File .\deploy\atualizar.ps1 -Ambiente producao
powershell -ExecutionPolicy Bypass -File .\deploy\criar-admin.ps1 -Ambiente producao
```

O `criar-admin` pede nome, e-mail e senha (mínimo 10 caracteres, sem eco na tela). O seed de demonstração **não roda**
em produção nem em staging.

## 3. Atualizar uma versão

1. PR no GitHub com o CI verde.
2. Staging: `atualizar.ps1 -Ambiente staging -Ref origin/<branch>` e teste no app e no site de teste.
3. Merge no `main`.
4. Produção: `atualizar.ps1 -Ambiente producao` (usa `origin/main`).

O [`atualizar.ps1`](../deploy/atualizar.ps1), em ordem:

1. faz **backup** do banco e dos documentos;
2. baixa o código e monta a imagem `buson-api:<commit>`;
3. aplica as **migrations** com a versão antiga ainda no ar;
4. sobe a nova versão e confere `/api/v1/saude`;
5. **se ela não responder em 2 minutos, volta sozinho para a anterior**.

Cada execução fica em `deploy\historico-<ambiente>.log`. Para voltar a uma versão antiga: `-Ref <commit>`. Mudou só o
arquivo de ambiente? Use `-Forcar`.

> Migrations que apagam colunas ou tabelas não têm volta automática: restaure o backup feito no início (seção 4).

## 4. Backup e restauração

- **Automático**, todo dia às `BACKUP_HORARIO` (padrão 03:00): dump do banco (`banco-<ambiente>-<data>.sql.gz`) e
  pacote dos documentos (`documentos-<ambiente>-<data>.tar.gz`). Ficam 14 dias na `PASTA_BACKUPS` e 30 no R2. Falhas
  vão para o Sentry.
- **Na hora**: `backup-agora.ps1 -Ambiente producao`.
- **Restaurar**:

  ```bash
  powershell -ExecutionPolicy Bypass -File .\deploy\restaurar.ps1 -Ambiente producao
  powershell -ExecutionPolicy Bypass -File .\deploy\restaurar.ps1 -Ambiente producao -Banco <banco-...sql.gz> -Documentos <documentos-...tar.gz>
  ```

  A primeira linha lista os backups. A segunda pede para digitar o nome do ambiente, faz um backup de segurança do
  estado atual e restaura. Arquivo do R2: baixe pelo painel para a `PASTA_BACKUPS`.
- **Teste a restauração todo mês no staging**: backup que nunca foi restaurado não é garantia.

## 5. Logs e manutenção

```bash
docker logs -f --tail 100 buson-producao-api-1      # API (JSON, com requestId)
docker logs --tail 50 buson-producao-backup-1       # último backup
docker compose ls                                   # ambientes rodando
```

Logs rotacionados (5 arquivos de 10 MB por container). O `atualizar.ps1` mantém as imagens recentes e apaga as antigas.

## 6. GitHub

- O **CI** ([`ci.yml`](../.github/workflows/ci.yml)) roda em cada push e PR:
  - API: formatação, tipos, lint, testes unitários, build, testes E2E contra um MySQL próprio e `npm audit`;
  - app: formatação, tipos, lint, testes unitários, `expo-doctor` e a montagem do site;
  - a imagem Docker da API.
- **CodeQL** procura falhas de segurança; **Dependabot** abre PRs semanais (dependências do Expo ficam de fora:
  atualize com `npx expo install --fix`).
- Proteja o `main` (*Settings › Branches › Add branch ruleset*): PR obrigatório, checks *API*, *App*, *Imagem Docker*
  e *CodeQL* obrigatórios, sem force push nem exclusão.
- *Settings › Code security*: *Dependabot alerts*, *Secret scanning* e *Push protection*.

## 7. Checklist de segurança

- [ ] `.env.producao` e `.env.staging` fora do git, com cópia num gerenciador de senhas.
- [ ] Segredos diferentes em produção e staging.
- [ ] MySQL sem porta exposta; a API usa o usuário `buson`, nunca o `root`.
- [ ] API ouvindo só em `127.0.0.1`; a internet chega só pelo túnel, em HTTPS.
- [ ] `TRUST_PROXY=1` e `CORS_ORIGINS` só com o site oficial do ambiente.
- [ ] Primeiro admin criado com o `criar-admin`; nenhum usuário de demonstração.
- [ ] BitLocker ligado (documentos e posições de GPS são dados pessoais, LGPD).
- [ ] Windows e Docker Desktop atualizados.
- [ ] UptimeRobot e Sentry avisando por e-mail.
- [ ] Restauração testada no staging no último mês.
