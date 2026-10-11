import React from "react";

/** No celular (APK) a tela é do tamanho certo: a moldura só existe na versão web (MolduraWeb.web.tsx). */
export function MolduraWeb({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
