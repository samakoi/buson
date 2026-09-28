import React from "react";
import { View } from "react-native";
import { useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { MenuConta } from "./MenuConta";
import { BotaoIcone } from "./BotaoIcone";

/**
 * Topo das telas: sobrescrito (ex.: a data), título, subtítulo, ações e o avatar da conta.
 * Em telas de detalhe, `onVoltar` mostra a seta de voltar no lugar do avatar.
 */
export function Cabecalho({
  titulo,
  subtitulo,
  sobrescrito,
  acoes,
  onVoltar,
}: {
  titulo: string;
  subtitulo?: string;
  sobrescrito?: string;
  acoes?: React.ReactNode;
  onVoltar?: () => void;
}) {
  const { espaco } = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.sm, marginBottom: espaco.lg }}>
      {onVoltar && <BotaoIcone icone="arrow-back" rotulo="Voltar" onPress={onVoltar} style={{ marginLeft: -10, marginTop: -6 }} />}
      <View style={{ flex: 1, gap: espaco.xxs }}>
        {sobrescrito ? (
          <Texto variante="legenda" cor="textoSuave">
            {sobrescrito}
          </Texto>
        ) : null}
        <Texto variante="titulo" accessibilityRole="header">
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto variante="pequeno" cor="textoSuave">
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.xs }}>
        {acoes}
        {!onVoltar && <MenuConta />}
      </View>
    </View>
  );
}
