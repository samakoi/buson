# Registros de decisão (ADR)

Cada arquivo registra uma decisão de arquitetura: o contexto, o que foi decidido e as consequências. Uma decisão nova
que substitua outra ganha um arquivo novo; o antigo fica com o status "Substituído por ADR-NNNN".

| ADR | Decisão | Status |
|---|---|---|
| [0001](./0001-api-express-prisma-mysql.md) | API em Express + Prisma + MySQL, módulos por assunto | Aceito |
| [0002](./0002-expo-um-codigo-android-e-web.md) | Expo: um código para o APK e o site | Aceito |
| [0003](./0003-vagas-por-dia-da-semana.md) | Vagas por dia da semana, com viagens geradas da programação | Aceito |
| [0004](./0004-hospedagem-docker-cloudflare.md) | Docker numa máquina própria + Cloudflare Tunnel, Pages e R2 | Aceito |
| [0005](./0005-react-query-dados-do-servidor.md) | TanStack Query para os dados do servidor no app | Aceito |
| [0006](./0006-tokens-securestore.md) | Tokens da sessão no SecureStore | Aceito |
| [0007](./0007-openapi-gerado-das-rotas.md) | OpenAPI gerado das rotas do Express e dos schemas zod | Aceito |
| [0008](./0008-estrategia-de-testes.md) | Testes: unitários (Vitest / jest-expo) + E2E da API | Aceito |

Modelo para uma decisão nova:

```markdown
# NNNN. Título curto

- Status: Proposto | Aceito | Substituído por ADR-NNNN
- Data: AAAA-MM-DD

## Contexto
## Decisão
## Consequências
```
