import React from "react";
import { View } from "react-native";
import { useTema } from "../../theme/TemaProvider";

/**
 * No computador o Bus On abre numa coluna central, do tamanho de um celular grande;
 * no celular ocupa a tela toda (a coluna nunca passa da largura da tela).
 */
const LARGURA_MAXIMA = 600;

export function MolduraWeb({ children }: { children: React.ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: cores.superficieAlt }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: LARGURA_MAXIMA,
          backgroundColor: cores.fundo,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: cores.borda,
        }}
      >
        {children}
      </View>
    </View>
  );
}
