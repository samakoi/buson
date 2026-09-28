import React from "react";
import { Pressable, View } from "react-native";
import { useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";

/** Título de seção com ação opcional à direita ("Ver todas"). */
export function Secao({ titulo, acao }: { titulo: string; acao?: { texto: string; onPress: () => void } }) {
  const { espaco } = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: espaco.lg, marginBottom: espaco.sm }}>
      <Texto variante="sobrescrito" cor="textoSuave">
        {titulo}
      </Texto>
      {acao && (
        <Pressable onPress={acao.onPress} hitSlop={12} accessibilityRole="button">
          <Texto variante="pequenoForte" cor="primaria">
            {acao.texto}
          </Texto>
        </Pressable>
      )}
    </View>
  );
}
