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
celular pelo **Expo Push**. A API já faz tudo sozinha (fila em segundo plano, vários
aparelhos por usuário, tokens inválidos descartados); falta só ligar o app às suas contas.

> O push **não funciona no Expo Go do Android**, no emulador nem no navegador — nesses
> casos os avisos ficam na aba Avisos. Ele funciona no **APK** gerado pelo EAS.

1. **Projeto EAS** (na pasta `mobile`, com a sua conta Expo):
   ```bash
   npx eas-cli login
   npx eas-cli init
   ```
   O `eas init` grava o `projectId` no `app.json` (`expo.extra.eas.projectId`) — é ele
   que o app usa para pedir o token de push.
2. **Firebase (Android)** — em https://console.firebase.google.com:
   - crie um projeto e adicione um app **Android** com o pacote `com.buson.app`;
   - baixe o `google-services.json`, coloque em `mobile/` e adicione no `app.json`:
     `"android": { "googleServicesFile": "./google-services.json", ... }`;
   - em *Configurações do projeto › Contas de serviço*, clique em **Gerar nova chave
     privada**. Guarde esse JSON fora do projeto (**nunca** no git).
3. **Enviar a chave para o EAS**: `npx eas-cli credentials` › Android › production ›
   Google Service Account › *Manage your Google Service Account Key for Push
   Notifications (FCM V1)* › *Upload a new service account key*.
4. **Gerar o APK**: ajuste `EXPO_PUBLIC_API_URL` no `mobile/eas.json` para o endereço
   público da API e rode `npx eas-cli build -p android --profile preview`.
5. **API**: no `backend/.env`, mantenha `PUSH_MODO=expo`. Os lembretes usam
   `LEMBRETE_VESPERA_HORARIO` (padrão 20:00) e `LEMBRETE_SAIDA_MINUTOS` (padrão 60).

No app, cada usuário escolhe em **Avisos › ⚙** se quer receber no celular os lembretes e
os avisos de vaga/lista de espera. Cadastro, documentos, faltas e viagem cancelada sempre
chegam.

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

## 8. O que ainda precisa ser construído (próximos passos)

- Recuperação de senha, edição de perfil e histórico completo do aluno
- Envio de localização em tempo real do motorista (`expo-location`) + mapa
  real no app do aluno (`react-native-maps`)
- Notificações push de verdade (Expo Notifications) — hoje os avisos só
  aparecem com o app aberto
- Exportar o relatório de faltas (CSV/PDF)
- Testes automatizados e pipeline de CI/CD
- Deploy da API (Railway, Render, AWS, etc.) e build do app para as lojas

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
→ A API já libera CORS para todas as origens (`cors()` sem restrição) — em
produção, restrinja isso à URL real do seu app.

**Porta 3333 ou 3306 já em uso**
→ Altere `PORT` no `.env` do backend, ou a porta mapeada no `docker-compose.yml`
(lembre de atualizar `DATABASE_URL` também).

---

Qualquer dúvida durante a instalação, volte à conversa com o Claude e descreva
o erro (pode colar a mensagem do terminal) para receber ajuda específica.
