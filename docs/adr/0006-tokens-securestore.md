# 0006. Tokens da sessão no SecureStore

- Status: Aceito
- Data: 2026-10-11

## Contexto

O access token e o refresh token ficavam no AsyncStorage, que no Android é um banco SQLite sem criptografia e entra no
backup automático do aparelho. O refresh token dá acesso à conta por dias.

## Decisão

- No Android/iOS, guardar os tokens no **expo-secure-store** (Keystore/Keychain), com `AFTER_FIRST_UNLOCK` para o GPS
  em segundo plano conseguir renovar a sessão com a tela bloqueada.
- No site, continuar no `localStorage` (o navegador não tem cofre equivalente), sem cópia em memória, porque várias
  abas compartilham os tokens.
- Migrar automaticamente os tokens que estavam no AsyncStorage na primeira abertura, sem pedir login.

## Consequências

- Os tokens deixam de aparecer em backups e em cópias do armazenamento do app.
- É uma mudança nativa: só vale a partir do APK que inclui o módulo (os APKs antigos não recebem essa atualização
  pela internet, por causa da `runtimeVersion`).
- A lógica fica isolada em `services/tokens.ts`, coberta por testes (migração, cache e corrida com o login).
