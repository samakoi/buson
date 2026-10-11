# Desenvolvimento local

Como rodar a API, o banco e o app na sua máquina, e como conferir o código antes de abrir um PR.

## 1. Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | **24** (o mesmo do Docker e do CI; está em [`.node-version`](../.node-version)) |
| Docker Desktop | recente (para o MySQL) |
| Git | recente |
| Expo Go no celular | compatível com o SDK 57 (opcional) |

O editor deve respeitar o [`.editorconfig`](../.editorconfig) e formatar com o Prettier da raiz
([`.prettierrc.json`](../.prettierrc.json)).

## 2. Banco de dados

Na raiz do repositório:

```bash
docker compose up -d
```

Sobe um MySQL 8 em `localhost:3306` com o banco `bus_on` e a senha `senha123` para o `root`, os mesmos valores do
`backend/.env.example`. Sem Docker, instale o MySQL e crie o banco `bus_on`; depois ajuste a `DATABASE_URL`.

## 3. API

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

- `prisma migrate dev` cria as tabelas e gera o Prisma Client.
- `npm run seed` cria dados de demonstração (pode rodar de novo sem duplicar). Usuários, todos com a senha `123456`:
  `admin@buson.com`, `motorista@buson.com` e `aluno@buson.com`.
- A API sobe em `http://localhost:3333/api/v1`. Confira em `/api/v1/saude`.
- **Documentação interativa:** `http://localhost:3333/api/v1/docs` (Swagger). Para testar uma rota protegida, faça
  login em `POST /auth/login`, copie o `accessToken` e use o botão **Authorize**. Veja [api.md](./api.md).
- `npx prisma studio` abre o banco no navegador.
- Os arquivos enviados pelos alunos ficam em `backend/uploads/` (ou em `UPLOADS_DIR`), fora do git.

As variáveis estão explicadas no [`backend/.env.example`](../backend/.env.example) e são validadas ao subir
([`config/env.ts`](../backend/src/config/env.ts)): com algo errado, a API nem inicia e diz o que falta.

## 4. App

Em outro terminal:

```bash
cd mobile
npm install
npx expo start
```

Aponte o app para a sua API com `EXPO_PUBLIC_API_URL`:

| Onde você testa | Endereço |
|---|---|
| Navegador (`w` no terminal do Expo) | `http://localhost:3333/api/v1` |
| Emulador Android | `http://10.0.2.2:3333/api/v1` |
| Celular na mesma rede Wi-Fi | `http://SEU_IP:3333/api/v1` (Windows: `ipconfig` › IPv4) |

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:3333/api/v1 npx expo start
```

No navegador, a origem do Expo precisa estar em `CORS_ORIGINS` no `backend/.env` (ex.: `http://localhost:8081`).

Push, GPS em segundo plano e atualizações pela internet só funcionam no APK (ou num development build), não no
Expo Go. Veja [app.md](./app.md).

### Roteiro rápido para conferir o sistema

1. **admin@buson.com**: *Cadastros* (ônibus, motoristas, universidades, rotas, pontos) e *Viagens › Programação
   semanal*; *Alunos* para aprovar documentos.
2. **aluno@buson.com**: *Início* › Confirmar presença; *Perfil* › Meus dias, Documentação e Minhas faltas.
3. **motorista@buson.com**: *Painel* › Iniciar viagem; *Embarque* (QR); *Passageiros*; *Rota*; Encerrar viagem.
4. **admin@buson.com**: *Dashboard* › relatório de presença e faltas e o mapa ao vivo.

## 5. Antes de abrir um PR

Os mesmos comandos que o CI roda ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):

| | API (`backend/`) | App (`mobile/`) |
|---|---|---|
| Formatação | `npm run format:check` (corrigir: `npm run format`) | `npm run format:check` |
| Tipos | `npm run typecheck` | `npm run typecheck` |
| Lint | `npm run lint` | `npm run lint` |
| Testes unitários | `npm test` (Vitest) | `npm test` (jest-expo) |
| Testes E2E | `npm run build && npm run test:e2e` | — |
| Outros | `npm audit --omit=dev` | `npx expo-doctor`, `npm run build:web -- producao` |

### Testes

- **Unitários** ficam ao lado do código: `*.test.ts` na API e `__tests__/*-test.ts` no app. Cobrem regras puras
  (datas, permissões, validações, formatos, tokens), sem banco nem rede. Rodam em segundos.
- **E2E da API** ([`backend/test/e2e`](../backend/test/e2e)) sobem a API compilada contra um banco próprio
  (`bus_on_test`, recriado a cada execução) e percorrem os fluxos de verdade. O executor **se recusa** a rodar num banco
  cujo nome não termine em `_test`. Localmente, com o MySQL do passo 2:

  ```bash
  MYSQL_CONTAINER=bus_on_mysql npm run test:e2e
  ```

- O teste [`docs/openapi.test.ts`](../backend/src/docs/openapi.test.ts) falha se uma rota nova não tiver descrição
  em `docs/rotas.ts`.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `P1001: Can't reach database server` | MySQL parado: `docker ps` |
| App sem nenhuma viagem | As viagens são do dia; rode `npm run seed` de novo ou gere pela *Programação semanal* |
| `Network Error` no celular | `EXPO_PUBLIC_API_URL` com IP errado, rede Wi-Fi diferente ou firewall bloqueando a 3333 |
| Erro de CORS | Só no navegador: inclua a origem em `CORS_ORIGINS` |
| Porta 3333 ou 3306 ocupada | Mude `PORT` no `.env` ou a porta no `docker-compose.yml` (e a `DATABASE_URL`) |
| `Configuração inválida no .env` | A mensagem lista a variável; compare com o `.env.example` |
