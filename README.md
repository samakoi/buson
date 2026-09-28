# 🚌 Bus On

Sistema de gestão de transporte universitário — API REST + banco MySQL + app
mobile em React Native (Expo).

Este pacote contém o código inicial (MVP) do projeto, implementando as regras
de negócio centrais descritas na documentação: reserva antecipada, lista de
espera inteligente, rota inteligente e confirmação de embarque via QR Code.

## Como rodar

Siga o **[GUIA_INSTALACAO.md](./GUIA_INSTALACAO.md)** — ele tem o passo a
passo completo, desde instalar o Node.js até testar o app no seu celular.

Resumo rápido (veja o guia para detalhes):

```bash
# 1. banco de dados
docker compose up -d

# 2. backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev

# 3. mobile (em outro terminal)
cd mobile
npm install
npx expo start
```

## Documentação

- `Bus_On_Documentacao_Completa.docx` (gerada anteriormente) — visão geral,
  regras de negócio, design system e roadmap completos.
- Este código implementa o backend e o app mobile a partir dessa
  especificação, seção por seção.

## Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, MySQL, JWT, Bcrypt, Zod
- **Mobile**: React Native, Expo, React Navigation, Axios, AsyncStorage
