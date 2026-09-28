import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../theme/TemaProvider";
import { NomeIcone } from "./icones";

/** Ícone tocável com área mínima de 44×44 (acessibilidade). `rotulo` é lido pelo leitor de tela. */
export function BotaoIcone({
  icone,
  onPress,
  rotulo,
  cor,
  tamanho = 20,
  style,
}: {
  icone: NomeIcone;
  onPress: () => void;
  rotulo: string;
  cor?: string;
  tamanho?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      style={({ pressed }) => [
        { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
        pressed && { backgroundColor: cores.superficieAlt },
        style,
      ]}
    >
      <Ionicons name={icone} size={tamanho} color={cor ?? cores.textoSuave} />
    </Pressable>
  );
}
