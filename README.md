# Bus On

Gestão do transporte universitário de Imperatriz (MA). Alunos reservam vaga por dia da semana e embarcam por QR Code,
motoristas operam a viagem e compartilham o GPS do ônibus, e a administração acompanha ocupação, documentos e faltas.

- **App Android** (APK) e **site** instalável (PWA) a partir do mesmo código: `app.onbus.online`
- **API** REST: `api.onbus.online/api/v1`

## O que o sistema faz

| Aluno | Motorista | Administração |
|---|---|---|
| Cadastro e envio do comprovante de matrícula | Viagens do dia, iniciar e encerrar | Alunos: busca, perfil, aprovação de documentos |
| Dias fixos de uso e confirmação de presença | QR de embarque e confirmação manual | Programação semanal, ônibus, rotas, pontos, motoristas |
| Lista de espera com aviso de vaga | Lista de passageiros e rota do dia | Dashboard: ocupação, presença e faltas |
| Onde está o ônibus (mapa) | GPS compartilhado durante a viagem | Mapa ao vivo e trajeto |
| Faltas e justificativas | Avisos | Decisão sobre justificativas, auditoria |

## Stack

| | |
|---|---|
| API | Node.js 24, Express, TypeScript, Prisma, MySQL 8, Zod, JWT, Pino, Sentry |
| App e site | Expo SDK 57 (React Native), React Navigation, TanStack Query, Zustand, Leaflet |
| Infraestrutura | Docker Compose, Cloudflare (Tunnel, Pages, R2), EAS (build, update, push), GitHub Actions |

## Começando

```bash
docker compose up -d                      # MySQL local

cd backend
cp .env.example .env && npm install
npx prisma migrate dev && npm run seed
npm run dev                               # http://localhost:3333/api/v1  (Swagger em /api/v1/docs)

cd ../mobile
npm install
npx expo start                            # w = navegador
```

Usuários de demonstração (senha `123456`): `admin@buson.com`, `motorista@buson.com`, `aluno@buson.com`.
O passo a passo completo está em [docs/desenvolvimento.md](./docs/desenvolvimento.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [Arquitetura](./docs/arquitetura.md) | visão geral, camadas, dados, sessão, tarefas em segundo plano, ambientes |
| [Desenvolvimento](./docs/desenvolvimento.md) | rodar localmente, testes, conferências antes do PR, problemas comuns |
| [API](./docs/api.md) | convenções, sessão, recursos, regras de negócio, como adicionar uma rota |
| [App](./docs/app.md) | organização, dados com React Query, sessão, push, GPS, APK e atualizações |
| [Site (PWA)](./docs/site.md) | montagem, segurança e publicação no Cloudflare Pages |
| [Implantação](./docs/deploy.md) | servidor, túnel, segredos, atualização, backup, monitoramento, segurança |
| [Decisões (ADR)](./docs/adr) | por que cada escolha de arquitetura foi feita |
| [Como contribuir](./CONTRIBUTING.md) | fluxo de branches, padrões e conferências |
| [Histórico](./CHANGELOG.md) | o que mudou em cada fase |

## Estrutura

```
backend/   API (src/modules por assunto, prisma/, test/e2e)
mobile/    app Android e site (src/features por assunto)
deploy/    Docker Compose de produção/staging e scripts de operação
docs/      documentação
```

## Próximos passos

- Recuperação de senha por e-mail
- Exportar o relatório de faltas (CSV/PDF)
- Avisos no celular para quem usa o site (Web Push)
- Publicação na Play Store (hoje o app é distribuído como APK e como site)
