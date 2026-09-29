import * as Sentry from "@sentry/react-native";

/**
 * Sentry no app (erros e travamentos em produção). Liga só com EXPO_PUBLIC_SENTRY_DSN
 * definido no build. Não envia dados pessoais: sem tela gravada, sem dados de usuário.
 * No navegador fica desligado (monitoramento.web.ts).
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export function iniciarMonitoramento() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_AMBIENTE ?? (__DEV__ ? "development" : "production"),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enabled: !__DEV__,
  });
}

/** Envolve o componente raiz (captura erros de renderização). */
export const envolverApp = (App: () => React.JSX.Element) => (dsn ? Sentry.wrap(App) : App);
