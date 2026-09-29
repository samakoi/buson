import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { API_URL } from "../../services/api";
import { criarEstilos } from "../../theme/TemaProvider";
import { DadosMapa, mapaHtml } from "./mapaHtml";

// Origem da página do mapa: os tiles do OpenStreetMap exigem um Referer válido
const ORIGEM = API_URL.replace(/\/api\/v1\/?$/, "/");

/** Mapa OpenStreetMap no celular (WebView). A versão do navegador está em MapaOSM.web.tsx. */
export function MapaOSM({ dados, altura = 320 }: { dados: DadosMapa; altura?: number }) {
  const s = useEstilos();
  const ref = useRef<WebView>(null);
  const pronto = useRef(false);
  const html = useMemo(() => mapaHtml(), []);

  const desenhar = useCallback(() => {
    ref.current?.injectJavaScript(`window.atualizar && window.atualizar(${JSON.stringify(dados)}); true;`);
  }, [dados]);

  useEffect(() => {
    if (pronto.current) desenhar();
  }, [desenhar]);

  return (
    <View style={[s.caixa, { height: altura }]}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: ORIGEM }}
        originWhitelist={["*"]}
        javaScriptEnabled
        scrollEnabled={false}
        onLoadEnd={() => {
          pronto.current = true;
          desenhar();
        }}
        accessibilityLabel="Mapa com a posição do ônibus"
      />
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  caixa: { borderRadius: t.raio.lg, overflow: "hidden", borderWidth: 1, borderColor: t.cores.borda, backgroundColor: t.cores.superficieAlt },
}));
