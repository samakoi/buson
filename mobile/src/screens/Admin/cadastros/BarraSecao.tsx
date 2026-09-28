import React from "react";
import { View } from "react-native";
import { useTema } from "../../../theme/TemaProvider";
import { Botao, Texto } from "../../../components/ui";

/** Topo de cada seção de cadastro: contagem + botão "Adicionar". */
export function BarraSecao({ texto, onAdicionar }: { texto: string; onAdicionar: () => void }) {
  const { espaco } = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: espaco.md }}>
      <Texto variante="pequenoForte" cor="textoSuave">
        {texto}
      </Texto>
      <Botao titulo="Adicionar" icone="add" variante="secundario" onPress={onAdicionar} style={{ minHeight: 40, paddingHorizontal: 14 }} />
    </View>
  );
}
