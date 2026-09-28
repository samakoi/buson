import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useTema } from "../theme/TemaProvider";

export function Carregando() {
  const { cores } = useTema();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: cores.fundo, minHeight: 160 }}>
      <ActivityIndicator color={cores.primaria} size="large" />
    </View>
  );
}
