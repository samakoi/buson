# Histórico de mudanças

As versões do Bus On são entregues por fases, cada uma num branch e PR próprio. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## Não lançado

### Fase 12: viagem com ida e volta e exclusão de rotas

- **Rota dentro da viagem**: a tela *Editar viagem* (nova e edição) tem dados gerais e as seções Ida e Volta, cada uma
  com origem, destino, horário e paradas próprias (adicionar, tirar e reordenar). Não é preciso cadastrar a rota antes.
  *Cadastros › Rotas* abre a mesma tela; os formulários antigos de programação e de rota saíram.
- **Banco**: tabela `trechos_rota`, `sentido` nas paradas, `atualizadoEm` e `excluidaEm` na rota. A migration copia as
  paradas atuais para a volta e cria os trechos, sem duplicar.
- **Exclusão de rota com alunos vinculados**: mostra o impacto, pede confirmação e faz exclusão lógica. Viagens futuras
  são canceladas com aviso, a programação é encerrada, os dias fixos são liberados com aviso e o histórico (viagens
  feitas, presenças, faltas, auditoria) é preservado. Viagem em andamento bloqueia.
- **Edição concorrente**: salvar com uma versão antiga é recusado, e a tela oferece recarregar a versão atual.
- **Aluno**: *Meus dias* mostra a viagem como uma opção só, com ida e volta descritas.
- Embarque, GPS e rota do dia do motorista usam as paradas do trecho certo.
- Testes: suíte E2E `rotas` (64 checagens), 15 unitários na API e 16 no app.

### Fase 11: histórico de viagens, senha forte e fluxos de uso

- **Histórico de viagens** (administração): botão Histórico na aba Viagens, com períodos prontos ou personalizado,
  filtros de rota, motorista, sentido e situação, totais do período e lista paginada. O detalhe mostra horários de
  início e fim, números, trajeto no mapa e a situação de cada passageiro. API: `GET /viagens/historico` e
  `GET /viagens/:id/detalhe`; a viagem passa a guardar `iniciadaEm` e `encerradaEm`.
- **Senha forte** ao criar conta (aluno, motorista e administrador): 8+ caracteres, com maiúscula, minúscula, número e
  caractere especial. O app marca cada requisito enquanto a pessoa digita. O login continua aceitando as senhas atuais.
- **Correção no site**: os ícones do menu e as imagens das bibliotecas não apareciam no Cloudflare Pages, que não
  publica pastas chamadas `node_modules`. O build do site agora usa `assets/pacotes` e falha se sobrar algo lá.
- **Fluxos de uso** em [docs/fluxos.md](./docs/fluxos.md) (Mermaid) e numa página visual clicável.
- Testes: suíte E2E nova do histórico (26 checagens) e testes unitários da regra de senha.

### Fase 10: qualidade, desempenho e documentação

**Padrões do repositório**
- `.editorconfig`, `.gitattributes` (LF; `.ps1` em CRLF) e `.node-version` (Node 24).
- Prettier em todo o projeto, com `format:check` no CI.
- Remoção de dependências sem uso no app (zod, react-hook-form) e de uma pasta criada por engano.

**App e site**
- Telas organizadas por assunto em `src/features/`.
- Só o Ionicons entra no pacote: site de 1,94 MB para 1,51 MB (551 KB para 417 KB comprimido).
- As abas de cada perfil são carregadas sob demanda (no site, um arquivo por perfil).
- Busca de dados unificada no TanStack Query (`useDadosDaTela` e hooks por assunto); cache compartilhado entre telas.
- Tokens da sessão no SecureStore no Android/iOS, com migração automática (exige APK novo).
- Correção: no histórico do aluno, documento aguardando análise aparecia como "Pendente".

**API**
- Desligamento gracioso no `docker stop` (antes o processo era encerrado à força depois de 10 s).
- Lista de viagens da administração começa hoje por padrão e tem teto de 300.
- Documentação OpenAPI 3.0 gerada das rotas e Swagger em `/api/v1/docs` (fora da produção).

**Testes e CI**
- Testes unitários: 47 na API (Vitest) e 39 no app (jest-expo), rodando no CI.

**Documentação**
- Nova pasta `docs/` (arquitetura, desenvolvimento, API, app, site, implantação e ADRs), `CONTRIBUTING.md` e este
  histórico. O `GUIA_INSTALACAO.md` virou índice e o `.docx` antigo foi removido.

## Fase 9: site (PWA) — 2026-10-10

- O app passa a rodar no navegador e pode ser instalado (PWA), para todos os perfis.
- Publicação no Cloudflare Pages com política de segurança (CSP) e cache por hash.
- Mapa e leitor de QR adaptados ao navegador; página `/instalar`.
- CORS por ambiente na API.

## Fase 8: APK — 2026-09-30

- Dois apps Android (oficial e "Bus On Teste") gerados no EAS.
- Atualização pela internet (EAS Update) e versão mínima exigida pela API.

## Fase 7: produção — 2026-09-29

- Docker Compose por ambiente, Cloudflare Tunnel, deploy com volta automática, backup diário com cópia no R2.
- CI no GitHub (tipos, lint, build, E2E, imagem Docker), CodeQL, Dependabot e Sentry.

## Fase 6: GPS dos ônibus — 2026-09-29

- Rastreamento do motorista (também em segundo plano no APK), mapa ao vivo, trajeto e apagamento automático das
  posições antigas.

## Fase 5: notificações no celular — 2026-09-29

- Push pelo Expo com fila, preferências por usuário e lembretes de viagem.

## Fase 4: faltas — 2026-09-29

- Falta registrada ao encerrar a ida, justificativa com anexo, decisão da administração e relatórios.

## Fase 3: documentos do aluno — 2026-09-29

- Envio do comprovante de matrícula, análise, aprovação, reprovação com motivo e reenvio.

## Fase 2: alocação por dia — 2026-09-28

- Programação semanal, dias fixos por aluno com capacidade por dia, viagens geradas automaticamente e pontos de
  embarque.

## Fase 1: QR do motorista — 2026-09-28

- Embarque pelo QR temporário mostrado pelo motorista.

## Fase 0: base técnica — 2026-09-28

- API versionada (`/api/v1`), respostas e erros padronizados, sessões com rotação de refresh token, permissões por
  ação e auditoria.
