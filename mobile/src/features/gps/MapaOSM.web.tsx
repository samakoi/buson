import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { criarEstilos } from "../../theme/TemaProvider";
import { DadosMapa, mapaHtml } from "./mapaHtml";

type JanelaMapa = Window & { atualizar?: (d: DadosMapa) => void };

/** Mapa OpenStreetMap no navegador (iframe com a mesma página do celular). */
export function MapaOSM({ dados, altura = 320 }: { dados: DadosMapa; altura?: number }) {
  const s = useEstilos();
  const ref = useRef<HTMLIFrameElement>(null);
  const [pronto, setPronto] = useState(false);
  const html = useMemo(() => mapaHtml(), []);

  useEffect(() => {
    const janela = ref.current?.contentWindow as JanelaMapa | null | undefined;
    if (pronto && janela?.atualizar) janela.atualizar(dados);
  }, [dados, pronto]);

  return (
    <View style={[s.caixa, { height: altura }]}>
      {React.createElement("iframe", {
        ref,
        srcDoc: html,
        title: "Mapa com a posição do ônibus",
        onLoad: () => setPronto(true),
        style: { border: 0, width: "100%", height: "100%" },
      })}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  caixa: { borderRadius: t.raio.lg, overflow: "hidden", borderWidth: 1, borderColor: t.cores.borda, backgroundColor: t.cores.superficieAlt },
}));
