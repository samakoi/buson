import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../theme/TemaProvider";
import { coresDoTom, Tom } from "../theme/tokens";
import { Texto } from "./Texto";
import { NomeIcone } from "./icones";

/** Etiqueta de status. Para status de viagem/check-in use os rótulos de utils/rotulos. */
export function Pilula({
  texto,
  tom = "neutro",
  icone,
  sobreDestaque,
  style,
}: {
  texto: string;
  tom?: Tom;
  icone?: NomeIcone;
  sobreDestaque?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { cores, raio, espaco } = useTema();
  const c = coresDoTom(cores, tom);
  // Sobre o cartão marinho, usa branco translúcido para não brigar com o fundo
  const fundo = sobreDestaque ? "rgba(255,255,255,0.16)" : c.fundo;
  const cor = sobreDestaque ? cores.sobreDestaque : c.cor;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: espaco.xs,
          backgroundColor: fundo,
          borderRadius: raio.pill,
          paddingHorizontal: espaco.sm + 2,
          paddingVertical: espaco.xs,
        },
        style,
      ]}
    >
      {icone && <Ionicons name={icone} size={13} color={cor} />}
      <Texto variante="legenda" cor={cor} style={{ fontWeight: "700" }}>
        {texto}
      </Texto>
    </View>
  );
}
