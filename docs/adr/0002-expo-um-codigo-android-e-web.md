# 0002. Expo: um código para o APK e o site

- Status: Aceito
- Data: 2026-10-10

## Contexto

O app nasceu em React Native com Expo para Android. Para implantar sem depender de loja (e atender iPhone), surgiu a
necessidade de uma versão web. As opções eram um site separado (ex.: React + Vite) ou exportar o próprio app para a web.

## Decisão

- Usar o **mesmo código** do Expo para o APK (EAS Build) e para o site (`expo export -p web`), publicado como PWA no
  Cloudflare Pages.
- Diferenças por plataforma ficam em arquivos `.web.tsx` (mapa, moldura, instalação), não em `if` espalhados.
- Atualizações só de JavaScript chegam ao APK pela internet (EAS Update, `runtimeVersion` por fingerprint); mudanças
  nativas exigem APK novo e a API pode exigir uma versão mínima.

## Consequências

- Uma correção vale para Android e web ao mesmo tempo; não há duas bases para manter.
- O site herda limites do navegador: GPS só com a tela aberta e, por enquanto, sem push (Web Push fica para depois).
- O pacote web precisa de cuidado com tamanho: só o Ionicons é importado e as abas de cada perfil são carregadas sob
  demanda.
