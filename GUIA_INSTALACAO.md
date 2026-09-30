# 🚌 Bus On — Guia de Instalação e Execução Local

Este guia explica passo a passo como rodar o projeto completo (API + banco de dados +
app mobile) na sua máquina, do zero.

O projeto tem duas partes:

```
bus-on/
├── backend/    → API REST (Node.js + Express + TypeScript + Prisma + MySQL)
├── mobile/     → App mobile (React Native com Expo)
└── docker-compose.yml → banco MySQL pronto para uso (opcional, recomendado)
```

---

## 1. Pré-requisitos

Instale antes de começar:

| Ferramenta | Versão recomendada | Link |
|---|---|---|
| Node.js | 22.13 ou superior (exigido pelo Expo SDK 57) | https://nodejs.org |
| npm | (vem com o Node) | — |
| Docker Desktop | recente | https://www.docker.com/products/docker-desktop *(opcional, mas facilita o MySQL)* |
| Expo Go (app no celular) | compatível com o SDK 57 | Android: Play Store • iOS: App Store |
| Git (opcional) | recente | https://git-scm.com |

Você **não precisa** instalar MySQL manualmente se usar o Docker (passo 2).
Se preferir, pode instalar o MySQL Community Server direto na sua máquina.

Verifique se o Node está instalado corretamente:

```bash
node -v
npm -v
```

---

## 2. Banco de dados (MySQL)

### Opção A — Docker (recomendado, mais rápido)

Na pasta raiz do projeto (`bus-on/`), rode:

```bash
docker compose up -d
```

Isso sobe um MySQL 8 na porta `3306`, já com o banco `bus_on` criado e a senha
`senha123` para o usuário `root` (esses valores já batem com o `.env.example`
do backend — se você mudar aqui, mude lá também).

Para conferir se subiu certo:

```bash
docker ps
```

### Opção B — MySQL instalado localmente

Se preferir não usar Docker, instale o MySQL normalmente e crie o banco:

```sql
CREATE DATABASE bus_on;
```

Depois ajuste a `DATABASE_URL` no `.env` do backend com seu usuário/senha reais.

---

## 3. Backend (API)

```bash
cd backend
cp .env.example .env
npm install
```

Abra o `.env` gerado e confira se a `DATABASE_URL` está correta (se você usou o
Docker do passo 2, o valor padrão já funciona sem alterações).

Agora crie as tabelas no banco a partir do schema do Prisma:

```bash
npx prisma migrate dev --name init
```

Esse comando cria as tabelas e gera o Prisma Client automaticamente. Se pedir um
nome de migração, pode aceitar `init`.

Popule o banco com dados de teste (universidades, ônibus, motorista, aluno e
uma viagem já com rota configurada):

```bash
npm run seed
```

Você verá no terminal os 3 usuários de teste criados (senha `123456` para todos):

```
admin@buson.com      (ADMIN)
motorista@buson.com  (MOTORISTA)
aluno@buson.com      (ALUNO)
```

Agora suba a API:

```bash
npm run dev
```

Se tudo certo, aparece:

```
🚌 Bus On API rodando em http://localhost:3333
```

Teste no navegador: abra `http://localhost:3333/api/v1/saude` — deve retornar um JSON
`{"data":{"api":"ok","banco":"ok", ...}}` (todas as respostas da API vêm dentro de `data`;
erros vêm como `{"error":{"code":"...","message":"..."}}`).

### Explorar o banco visualmente (opcional)

```bash
npx prisma studio
```

Abre uma interface no navegador para ver e editar os dados das tabelas.

### Arquivos enviados pelos alunos (documentos)

Os comprovantes de matrícula ficam em `backend/uploads/` (ou na pasta definida em
`UPLOADS_DIR` no `.env`). Essa pasta fica fora do git e fora da parte pública da API:
os arquivos só abrem por um link temporário gerado pelo app. O banco guarda apenas os
dados do arquivo, então **faça backup desta pasta junto com o backup do banco** — sem
ela, os documentos já enviados não abrem mais.

---

## 4. App mobile (React Native / Expo)

Abra um **novo terminal** (deixe a API rodando no outro) e rode:

```bash
cd mobile
npm install
```

### 4.1 Aponte o app para a sua API

Abra o arquivo `mobile/src/services/api.ts` e ajuste a constante `API_URL`
conforme como você vai testar o app:

| Onde você vai testar | Valor de `API_URL` |
|---|---|
| Navegador (`npx expo start --web`) | `http://localhost:3333/api/v1` (já é o padrão) |
| Emulador Android (Android Studio) | `http://10.0.2.2:3333/api/v1` |
| Simulador iOS (Mac) | `http://localhost:3333/api/v1` |
| Celular físico com o app **Expo Go** | `http://SEU_IP_LOCAL:3333/api/v1` |

Para descobrir o "SEU_IP_LOCAL" (necessário para testar no celular físico, já
que ele precisa enxergar seu computador na mesma rede Wi-Fi):

- **Windows**: `ipconfig` → veja "Endereço IPv4" (ex.: `192.168.0.10`)
- **Mac/Linux**: `ifconfig` ou `ip a` → veja o IP da sua rede (ex.: `192.168.0.10`)

Exemplo final no arquivo:
```ts
export const API_URL = "http://192.168.0.10:3333/api/v1";
```

Ou, sem editar o arquivo, defina a variável ao iniciar o Expo:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:3333/api/v1 npx expo start
```

> ⚠️ O celular e o computador precisam estar **na mesma rede Wi-Fi** para isso
> funcionar. Se o seu firewall bloquear a porta 3333, libere-a ou desative
> temporariamente para testar.

### 4.2 Iniciar o app

> ℹ️ O app usa o **Expo SDK 57**. No lançamento do SDK 57, o Expo Go ainda não
> estava nas lojas: no Android (celular ou emulador) e no simulador iOS o próprio
> Expo CLI instala a versão certa do Expo Go; no iPhone físico use `eas go`
> (veja https://expo.dev/changelog/sdk-57). Para produção, prefira development builds.

```bash
npx expo start
```

Vai abrir um QR Code no terminal (e uma aba no navegador com o Metro Bundler).

- **No celular**: abra o app **Expo Go**, escaneie o QR Code (Android: dentro
  do próprio app; iOS: pela câmera nativa) e o Bus On vai carregar.
- **No emulador Android**: com o Android Studio aberto e um emulador rodando,
  pressione `a` no terminal do Expo.
- **No simulador iOS** (só em Mac): pressione `i` no terminal do Expo.
- **No navegador**: pressione `w` no terminal do Expo.

### 4.3 Testar o login

Use qualquer um dos usuários criados pelo `npm run seed`:

| Perfil | E-mail | Senha |
|---|---|---|
| Aluno | aluno@buson.com | 123456 |
| Motorista | motorista@buson.com | 123456 |
| Administrador | admin@buson.com | 123456 |

---

## 5. Fluxo sugerido para validar o sistema

1. Entre como **admin@buson.com** → aba "Viagens" → "Nova viagem" (se a
   viagem de hoje já tiver sido encerrada). Em "Cadastros" você também
   cadastra ônibus, motoristas, universidades e rotas, e liga/desliga a
   **manutenção** de um ônibus.
2. Entre como **aluno@buson.com** (ou crie uma conta em "Criar conta de
   aluno") → "Início" → "Confirmar presença". A tela mostra as vagas livres,
   a posição na lista de espera e avisa se o ônibus estiver em manutenção.
   A aba "Avisos" mostra as notificações (com contador na aba).
3. Entre como **motorista@buson.com** → aba "Painel" → "Iniciar viagem"
   (o check-in e o cancelamento só são aceitos antes de a viagem começar, e o
   embarque só depois que ela começa; ônibus em manutenção não sai).
4. Ainda como motorista → aba "Embarque" → aponte a câmera para o QR Code do
   aluno (aba "QR Code" no celular do aluno). Sem câmera, use "Confirmar" na
   aba "Passageiros".
5. Ainda como motorista → aba "Rota" → veja que o **CEUMA** aparece como
   "Sem passageiros" (regra da rota inteligente), enquanto FACIMP tem o aluno
   confirmado. Depois, "Encerrar viagem" no Painel.
6. Volte como **admin@buson.com** → "Dashboard" → "Relatório de presença":
   filtre por Hoje, 7 dias, 30 dias, Este mês ou um período personalizado e
   veja embarques, faltas, taxa de presença e quem faltou.

---

## 6. Estrutura de pastas

```
backend/
├── prisma/
│   ├── schema.prisma      → modelos do banco (15 tabelas)
│   └── seed.ts             → dados de teste
├── src/
│   ├── config/              → env e conexão do Prisma
│   ├── middlewares/         → autenticação JWT, tratamento de erros
│   ├── modules/
│   │   ├── auth/             → login, cadastro, refresh token
│   │   ├── viagens/          → check-in, lista de espera, rota inteligente, embarque
│   │   ├── universidades/
│   │   ├── onibus/
│   │   ├── rotas/
│   │   └── dashboard/        → estatísticas para o admin
│   ├── routes/index.ts       → agregador de rotas
│   ├── app.ts
│   └── server.ts
└── package.json

mobile/
├── App.tsx
├── src/
│   ├── contexts/AuthContext.tsx
│   ├── navigation/            → RootNavigator + tabs por perfil
│   ├── screens/
│   │   ├── Auth/
│   │   ├── Aluno/
│   │   ├── Motorista/
│   │   └── Admin/
│   ├── services/api.ts        → instância do axios com JWT
│   ├── theme/colors.ts         → paleta e tokens de design
│   └── types/
└── package.json
```

---

## 6.1 Push no celular (EAS + Firebase)

Os avisos do app (vaga, lembrete de viagem, documento, faltas…) também são enviados ao
celular pelo **Expo Push**. A API já faz tudo sozinha: fila em segundo plano, vários
aparelhos por usuário e descarte de tokens inválidos. Falta só ligar o app às suas contas.

> O push **não funciona no Expo Go do Android**, no emulador nem no navegador. Nesses
> casos, os avisos ficam só na aba Avisos. Ele funciona no **APK** (seção 11).

1. **Projeto EAS** (na pasta `mobile`, com a sua conta Expo):
   ```bash
   npx eas-cli login
   npx eas-cli init
   ```
   O `projectId` do projeto fica em `EAS_PROJECT_ID`, no `mobile/app.config.ts`. Ele não é
   segredo: o push e as atualizações pela internet usam esse identificador.
2. **Firebase (Android)**, em https://console.firebase.google.com:
   - crie o projeto e adicione dois apps **Android**: `com.buson.app` (oficial) e
     `com.buson.app.staging` (Bus On Teste);
   - baixe o `google-services.json`, que vale para os dois apps. Guarde-o **fora do git**,
     porque o repositório é público;
   - em *Configurações do projeto › Contas de serviço*, clique em **Gerar nova chave privada**
     e guarde esse JSON fora do projeto.
3. **Enviar os arquivos ao EAS** (expo.dev › projeto):
   - em *Environment variables › Add variable*, crie a variável `GOOGLE_SERVICES_JSON`,
     do tipo **File**, com o `google-services.json`, visibilidade **Secret**, nos
     ambientes `preview` e `production`;
   - em *Credentials › Android*, abra cada pacote (`com.buson.app` e
     `com.buson.app.staging`), vá em *FCM V1 service account key* e envie a chave privada.
4. **API**: mantenha `PUSH_MODO=expo`. Os lembretes usam `LEMBRETE_VESPERA_HORARIO`
   (padrão 20:00) e `LEMBRETE_SAIDA_MINUTOS` (padrão 60).

No app, cada usuário escolhe em **Avisos › ⚙** se quer receber no celular os lembretes e
os avisos de vaga e de lista de espera. Cadastro, documentos, faltas e viagem cancelada
sempre chegam.

---

## 6.2 GPS dos ônibus e mapa

- **Motorista:** ao iniciar a viagem, o app pede a localização e compartilha a posição até
  encerrar. No **APK**, peça ao motorista para escolher **"Permitir o tempo todo"** — assim
  o GPS continua com a tela apagada (aparece a notificação fixa "Compartilhando a
  localização do ônibus"). No Expo Go e no navegador ele envia só com o app aberto.
- **Aluno:** na tela Início, com a viagem em andamento, toque em **"Ver onde está o
  ônibus"**. Para mostrar a distância até o ponto/instituição, cadastre a localização em
  *Cadastros › Pontos* e *Cadastros › Universidades* (botão "Usar minha localização atual"
  no local, ou cole "latitude, longitude" do Google Maps).
- **Admin:** no Dashboard, "Ver ônibus no mapa (ao vivo)" mostra os ônibus em viagem e o
  trajeto de cada um.
- **Mapa:** OpenStreetMap, gratuito e sem chave. Se o uso crescer muito, troque o
  servidor de mapas com `EXPO_PUBLIC_MAPA_TILES` (URL no formato `.../{z}/{x}/{y}.png`)
  respeitando os termos do provedor.
- **Privacidade:** as posições ficam guardadas por `GPS_RETENCAO_DIAS` (padrão 90) no
  `backend/.env` e depois são apagadas automaticamente. O aluno só vê o ônibus da viagem
  em que tem vaga, e só enquanto ela está em andamento.

---

## 6.3 Testes automáticos e qualidade

Na pasta `backend`, com o MySQL do passo 2 rodando:

```bash
npm run build
MYSQL_CONTAINER=bus_on_mysql npm run test:e2e   # 10 suítes contra o banco bus_on_test
npm run lint
npm run typecheck
```

Os testes usam um banco próprio (`bus_on_test`, recriado a cada execução) e **se recusam a
rodar** em bancos cujo nome não termine em `_test`. No app (`mobile`), use `npm run lint`,
`npm run typecheck` e `npx expo-doctor`. O GitHub roda tudo isso sozinho a cada push (seção 10.11).

---

## 7. O que já está implementado

- Autenticação com JWT (login + cadastro de aluno pelo app + refresh token automático)
- Regra 3.1 — Reserva antecipada (check-in fecha ao atingir o limite de vagas)
- Regra 3.2 — Lista de espera inteligente (promoção automática ao cancelar, com posição na fila)
- Regra 3.3 — Rota inteligente (pontos sem alunos ficam marcados como removidos)
- Regra 3.5 — QR Code do aluno + leitura pela câmera do motorista (`expo-camera`)
- Início/encerramento de viagem pelo motorista, com contadores de embarque
- Manutenção de ônibus: o admin marca/desmarca (com observação), alunos e
  motoristas veem o status e os alunos afetados são notificados
- Avisos (notificações) no app do aluno, com contador na aba
- Admin: criação/exclusão de viagens e cadastro de ônibus, motoristas,
  universidades e rotas
- Dashboard com relatório de presença e faltas, filtro por período e gráfico diário
- Programação semanal por rota: as viagens de ida e volta são geradas sozinhas, com
  capacidade controlada por dia e pontos de embarque
- Alunos escolhem os dias de uso; documentação da matrícula analisada pelo admin
- Faltas registradas ao encerrar a ida, com justificativa, anexo e decisão do admin
- Push no celular e lembretes de viagem (seção 6.1)
- GPS do ônibus em tempo real, com mapa para o aluno e para o admin (seção 6.2)
- Testes E2E, CI no GitHub, Sentry, deploy em Docker com backup e volta automática (seção 10)

## 8. O que ainda precisa ser construído (próximos passos)

- Recuperação de senha por e-mail
- Exportar o relatório de faltas (CSV/PDF)
- Publicação na Play Store (hoje o app é distribuído como APK; veja a seção 6.1)

---

## 9. Problemas comuns

**"Error: P1001: Can't reach database server"**
→ O MySQL não está rodando. Confira com `docker ps` (opção Docker) ou o
serviço do MySQL local.

**O app não mostra nenhuma viagem**
→ O app só mostra as viagens **do dia**. Rode `npm run seed` de novo (ele
cria a viagem de hoje sem duplicar os outros dados).

**App no celular não conecta na API ("Network Error")**
→ Confira se `API_URL` em `mobile/src/services/api.ts` está com o IP correto
da sua máquina, e se o celular está na mesma rede Wi-Fi.

**Erro de CORS**
→ Só acontece no navegador (Expo web). Coloque a origem em `CORS_ORIGINS` no
`backend/.env` (ex.: `http://localhost:8081`). O app no celular não usa CORS.

**Porta 3333 ou 3306 já em uso**
→ Altere `PORT` no `.env` do backend, ou a porta mapeada no `docker-compose.yml`
(lembre de atualizar `DATABASE_URL` também).

---

## 10. Produção e staging nesta máquina (Docker + Cloudflare)

A API roda em Docker nesta máquina e chega à internet pelo **Cloudflare Tunnel** (HTTPS,
sem abrir portas no roteador). Produção e staging ficam totalmente separados: cada um tem
o próprio MySQL, documentos, backups, túnel e segredos.

```
Celular ──HTTPS──▶ Cloudflare ──túnel──▶ cloudflared ──▶ api (Node) ──▶ mysql
                                                          │
                                         backup diário ───┴──▶ pasta local + Cloudflare R2
```

| | Produção | Staging |
|---|---|---|
| Pasta do servidor | `C:\buson\producao` | `C:\buson\staging` |
| Arquivo de ambiente | `deploy\.env.producao` | `deploy\.env.staging` |
| API na própria máquina | `http://127.0.0.1:4000` | `http://127.0.0.1:4001` |
| Endereço público | `https://api.onbus.online` | `https://api-staging.onbus.online` |

### 10.1 Pré-requisitos

- **Docker Desktop**, com *Start Docker Desktop when you sign in* ligado (Settings › General).
- **Git**.
- A máquina precisa ficar ligada: desative a suspensão em *Configurações › Sistema › Energia*.
- O domínio precisa estar no Cloudflare (DNS gerenciado por ele).

Os scripts ficam em `deploy\`. Rode-os no PowerShell com
`powershell -ExecutionPolicy Bypass -File <script> ...`, que libera só aquela execução e não
muda nenhuma configuração do Windows.

### 10.2 Uma cópia do repositório só para o servidor

Não use a pasta de desenvolvimento: o script de atualização troca o commit da pasta.

```bash
git clone https://github.com/samakoi/buson.git C:\buson\producao
git clone https://github.com/samakoi/buson.git C:\buson\staging
```

Nunca edite arquivos nessas pastas. Se houver alguma alteração local, o `atualizar.ps1` se recusa a rodar.

### 10.3 Segredos do ambiente

```bash
cd C:\buson\producao
powershell -ExecutionPolicy Bypass -File .\deploy\gerar-segredos.ps1 -Ambiente producao
notepad .\deploy\.env.producao
```

O script cria o arquivo com o `JWT_SECRET` e as senhas do MySQL já aleatórias. Staging gera
outros valores, sem nada compartilhado. Complete as seções 10.4 a 10.6 no arquivo
e **guarde uma cópia dele num gerenciador de senhas**. O arquivo nunca vai para o git
(o `.gitignore` bloqueia).

### 10.4 Cloudflare Tunnel (acesso pela internet)

1. No Cloudflare, abra *Zero Trust › Networks › Tunnels › Create a tunnel* e escolha *Cloudflared*.
   Dê o nome `buson-producao`.
2. Na tela de instalação, copie **só o token**, o texto longo depois de `--token`, e cole em
   `TUNNEL_TOKEN=` no `.env.producao`. Não precisa instalar nada: o container `cloudflared`
   já está no compose.
3. Em *Public Hostname*, adicione:
   - *Subdomain* `api`, com o seu domínio;
   - *Service type* `HTTP`;
   - *URL* `api:3333`.
4. Para staging, repita com outro túnel (`buson-staging`), o hostname `api-staging` e o mesmo
   serviço `api:3333`, e cole o token no `.env.staging`.

Mantenha `TRUST_PROXY=1`, para o limite de tentativas de login enxergar o IP real, e
`CORS_ORIGINS` vazio: o app Android não precisa de CORS.

**Ajustes de segurança no Cloudflare** (painel do domínio `onbus.online`):
- *SSL/TLS › Edge Certificates*: ligue **Always Use HTTPS** e ponha **Minimum TLS Version** em 1.2.
- *Security › WAF › Rate limiting rules*: crie a regra "login" com as condições
  *URI Path* começa com `/api/v1/auth/` e *mais de 30 requisições em 1 minuto pelo mesmo IP*.
  A ação é *Block* por 10 minutos. É uma segunda barreira, além do limite que a própria API já faz.
- *Security › Bots*: deixe o **Bot Fight Mode DESLIGADO**. Ele bloqueia apps que não são
  navegador, e o Bus On pararia de funcionar.
- *Notifications › Add*: crie o aviso **Tunnel Health Alert** para o seu e-mail, que avisa
  se um túnel cair.

### 10.5 Cloudflare R2 (cópia dos backups fora da máquina)

1. No Cloudflare, abra *R2 › Create bucket* e crie o `buson-backups`. Um bucket serve para os
   dois ambientes: cada um grava na sua pasta, `production/` ou `staging/`.
2. Em *R2 › Manage R2 API Tokens › Create API token*, escolha a permissão *Object Read & Write*,
   só para o bucket `buson-backups`.
3. Preencha no arquivo de ambiente os campos `R2_ACCOUNT_ID` (o Account ID do painel do R2),
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET=buson-backups`.

### 10.6 Sentry (erros) e UptimeRobot (fora do ar)

- **Sentry** (https://sentry.io): crie dois projetos.
  - **API** (plataforma *Node.js*): cole o DSN dele em `SENTRY_DSN` no arquivo de ambiente.
  - **App** (plataforma *React Native*): em expo.dev › projeto › *Environment variables*, crie
    `EXPO_PUBLIC_SENTRY_DSN` com o DSN do app (visibilidade *Plain text*) para `preview` (app de teste) e
    `production`.

  Nenhum dos dois envia dados pessoais: sem cabeçalhos, senhas, corpos de requisição nem tela
  gravada.
- **UptimeRobot** (https://uptimerobot.com): crie um monitor *HTTP(s)* para
  `https://api.onbus.online/api/v1/saude` a cada 5 minutos, com alerta por e-mail ou Telegram. Esse
  endereço só responde "ok" se a API **e** o banco estiverem funcionando.

### 10.7 Primeira instalação

```bash
cd C:\buson\producao
powershell -ExecutionPolicy Bypass -File .\deploy\atualizar.ps1 -Ambiente producao
powershell -ExecutionPolicy Bypass -File .\deploy\criar-admin.ps1 -Ambiente producao
```

O `criar-admin` pede nome, e-mail e senha. A senha não aparece na tela e precisa ter
no mínimo 10 caracteres. O seed de demonstração (senha 123456) **não roda** em produção nem em staging.
Depois, abra `https://api.onbus.online/api/v1/saude` no navegador. Para gerar o APK, veja a seção 11.

### 10.8 Atualizar uma versão

O caminho de uma mudança até a produção:

1. PR no GitHub com o CI verde.
2. Staging: `atualizar.ps1 -Ambiente staging -Ref origin/<branch>`. Teste no app.
3. Merge no `main`.
4. Produção: `atualizar.ps1 -Ambiente producao`, que usa `origin/main` por padrão.

O que o `atualizar.ps1` faz, em ordem:

1. **Backup** do banco e dos documentos.
2. Baixa o código e monta a imagem `buson-api:<commit>`.
3. Aplica as **migrations** enquanto a versão antiga continua no ar.
4. Sobe a nova versão e confere `/api/v1/saude`.
5. **Se a nova versão não responder em 2 minutos, volta sozinho para a anterior.**

Cada execução fica registrada em `deploy\historico-<ambiente>.log`. Para voltar a uma versão
antiga à mão, use `-Ref <commit>`, com o código de 12 letras que aparece no histórico.

> Migrations que apagam colunas ou tabelas não têm volta automática. Nesse caso, restaure o
> backup feito no início da atualização (seção 10.9).

### 10.9 Backup e restauração

- **Automático:** todo dia às `BACKUP_HORARIO` (padrão 03:00), o container `backup` faz:
  - o dump do banco (`banco-<ambiente>-<data>.sql.gz`);
  - o pacote dos documentos (`documentos-<ambiente>-<data>.tar.gz`).

  Ficam 14 dias na `PASTA_BACKUPS` e 30 dias no R2. Se o backup falhar, o erro chega ao Sentry.
- **Na hora:** `backup-agora.ps1 -Ambiente producao`.
- **Restaurar:**
  ```bash
  powershell -ExecutionPolicy Bypass -File .\deploy\restaurar.ps1 -Ambiente producao
  powershell -ExecutionPolicy Bypass -File .\deploy\restaurar.ps1 -Ambiente producao -Banco <banco-...sql.gz> -Documentos <documentos-...tar.gz>
  ```
  A primeira linha só lista os backups. A segunda restaura, e antes disso:
  - pede para você digitar o nome do ambiente;
  - faz um backup de segurança do estado atual.

  Para usar um arquivo do R2, baixe-o pelo painel e coloque-o na `PASTA_BACKUPS` do ambiente.
- **Teste a restauração uma vez por mês no staging:** copie os arquivos de produção para a
  pasta de backups do staging e restaure lá. Backup que nunca foi restaurado não é garantia.

### 10.10 Logs e manutenção

```bash
docker logs -f --tail 100 buson-producao-api-1      # logs da API (JSON, com requestId)
docker logs --tail 50 buson-producao-backup-1       # último backup
docker compose ls                                   # ambientes rodando
```

Os logs de cada container são rotacionados: até 5 arquivos de 10 MB. O `atualizar.ps1` guarda as
imagens mais recentes e apaga as mais antigas.

### 10.11 GitHub: CI e proteção do main

- Cada push e cada PR rodam o **CI** (`.github/workflows/ci.yml`):
  - tipos, lint, build e os 10 testes E2E da API, contra um MySQL próprio do CI;
  - `npm audit`;
  - tipos, lint e `expo-doctor` do app;
  - montagem da imagem Docker.

  O **CodeQL** procura falhas de segurança no código, e o **Dependabot** abre PRs semanais de
  atualização. As dependências do Expo ficam de fora do Dependabot: atualize-as com
  `npx expo install --fix`.
- Proteja o `main` em *Settings › Branches › Add branch ruleset*:
  - exigir pull request;
  - exigir que passem os checks *API (tipos, lint, testes E2E)*, *App (tipos, lint, expo-doctor)*,
    *Imagem Docker da API* e *CodeQL*;
  - bloquear force push e exclusão.
- Em *Settings › Code security*, ligue *Dependabot alerts*, *Secret scanning* e *Push protection*.
  Todos são gratuitos em repositório público.

### 10.12 Checklist de segurança

- [ ] `.env.producao` e `.env.staging` fora do git, com cópia num gerenciador de senhas.
- [ ] Segredos diferentes em produção e staging (cada `gerar-segredos` gera os seus).
- [ ] MySQL sem porta exposta, e a API usando o usuário `buson`, nunca o `root`.
- [ ] API ouvindo só em `127.0.0.1`. A internet chega só pelo túnel, em HTTPS.
- [ ] `TRUST_PROXY=1` e `CORS_ORIGINS` vazio (ou só o domínio de um site oficial).
- [ ] Primeiro admin criado com o `criar-admin` e senha forte. Nenhum usuário de demonstração.
- [ ] BitLocker ligado no disco, porque documentos e posições de GPS são dados pessoais (LGPD).
- [ ] Windows e Docker Desktop atualizados.
- [ ] UptimeRobot e Sentry avisando por e-mail.
- [ ] Restauração testada no staging no último mês.

---

## 11. O app Android (APK)

São dois apps, que podem ficar instalados lado a lado no mesmo celular:

| | Bus On (oficial) | Bus On Teste |
|---|---|---|
| Pacote | `com.buson.app` | `com.buson.app.staging` |
| Fala com | `https://api.onbus.online` | `https://api-staging.onbus.online` |
| Perfil do build (`mobile/eas.json`) | `production` | `staging` |
| Canal de atualização | `production` | `staging` |
| Ícone | fundo azul | fundo laranja |

O endereço da API de cada app fica no `eas.json`. Um build sem endereço `https://` é recusado
antes de começar. Assim, nenhum APK sai apontando para o IP da rede local.

### 11.1 Gerar o APK

Antes, faça a seção 6.1 (conta Expo, `eas init` e Firebase). Depois, na pasta `mobile`:

```bash
npm run build:staging     # Bus On Teste
npm run build:producao    # Bus On (oficial)
```

O build roda na nuvem do Expo e leva de 10 a 20 minutos. No fim aparece um **link** (e um QR)
da página do build no expo.dev: quem abrir o link no celular baixa e instala o APK.
O Android pede para permitir a instalação de "fontes desconhecidas", e isso é normal para
APK fora da Play Store.

Cada build ganha um número novo (o `versionCode`, que aparece como "build N" no app).

**Cópia da chave de assinatura (obrigatório):** o EAS cria e guarda a chave que assina o APK.
Baixe uma cópia com `npx eas-cli credentials` › Android › production › *Keystore* ›
*Download*, e guarde-a no gerenciador de senhas. **Sem essa chave, nenhum APK novo consegue
atualizar o app já instalado nos celulares.** Repita para o perfil `staging`.

### 11.2 Atualizações

**Correções só de código (telas, textos, regras no app)** chegam pela internet, sem
reinstalar:

```bash
npm run atualizacao -- staging "Corrige o texto da tela de faltas"
npm run atualizacao -- producao "Corrige o texto da tela de faltas"
```

O app procura atualização ao abrir e sempre que volta para a tela, e a nova versão vale
na próxima abertura. No menu da conta (as iniciais no topo) aparecem a versão e o botão
**Procurar atualização**, que aplica na hora. Publique primeiro no `staging`, teste no Bus On
Teste e só depois publique no `producao`.

**Mudanças nativas** (biblioteca nova com código nativo, permissão, plugin, versão do Expo) **não
chegam pela internet**. A atualização só é entregue a APKs com o mesmo código nativo, então
esses casos exigem um APK novo:

1. Gere e distribua o APK novo (11.1).
2. No arquivo de ambiente do servidor, defina:
   - `APP_VERSAO_MINIMA_ANDROID` com o número do build novo;
   - `APP_LINK_ANDROID` com o link da página do build.
3. Aplique com `atualizar.ps1 -Ambiente <ambiente> -Forcar`.

Quem ainda tiver um APK mais antigo vê a tela **"Atualize o Bus On"**, com o botão para baixar.

### 11.3 Roteiro de teste de um APK novo

No **Bus On Teste**, com a API de staging, confira:
- login dos três perfis;
- QR de embarque pela câmera;
- envio de documento (foto e PDF);
- o **push** chegando com o app fechado;
- o **GPS com a tela apagada** (o motorista escolhe "Permitir o tempo todo");
- o mapa ao vivo;
- a versão no menu da conta.

Só depois gere o APK oficial.

---

Qualquer dúvida durante a instalação, volte à conversa com o Claude e descreva
o erro (pode colar a mensagem do terminal) para receber ajuda específica.
