/** No navegador (Expo web, só para desenvolvimento) o Sentry fica desligado. */
export function iniciarMonitoramento() {}

export const envolverApp = (App: () => React.JSX.Element) => App;
