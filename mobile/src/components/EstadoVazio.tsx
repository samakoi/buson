import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { Botao } from "./Botao";
import { NomeIcone } from "./icones";

export function EstadoVazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: NomeIcone;
  titulo: string;
  texto?: string;
  acao?: { titulo: string; onPress: () => void; icone?: NomeIcone };
}) {
  const { cores, espaco } = useTema();
  return (
    <View style={{ alignItems: "center", paddingVertical: espaco.xxxl, paddingHorizontal: espaco.xl, gap: espaco.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: cores.superficieAlt, alignItems: "center", justifyContent: "center", marginBottom: espaco.xs }}>
        <Ionicons name={icone} size={30} color={cores.textoFraco} />
      </View>
      <Texto variante="subtitulo" alinhar="center">
        {titulo}
      </Texto>
      {texto ? (
        <Texto variante="pequeno" cor="textoSuave" alinhar="center">
          {texto}
        </Texto>
      ) : null}
      {acao && <Botao titulo={acao.titulo} icone={acao.icone} variante="secundario" onPress={acao.onPress} style={{ marginTop: espaco.md }} />}
    </View>
  );
}
