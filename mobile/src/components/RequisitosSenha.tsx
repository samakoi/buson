import React from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { REQUISITOS_SENHA } from "../utils/senha";
import { Texto } from "./Texto";

/** Lista dos requisitos da senha nova, marcando cada um assim que é cumprido. */
export function RequisitosSenha({ senha }: { senha: string }) {
  const { cores } = useTema();
  const s = useEstilos();
  return (
    <View style={s.lista} accessibilityLabel="Requisitos da senha">
      {REQUISITOS_SENHA.map((r) => {
        const ok = r.ok(senha);
        return (
          <View key={r.texto} style={s.item} accessibilityLabel={`${r.texto}: ${ok ? "cumprido" : "pendente"}`}>
            <Ionicons name={ok ? "checkmark-circle" : "ellipse-outline"} size={16} color={ok ? cores.sucesso : cores.textoSuave} />
            <Texto variante="pequeno" cor={ok ? "sucesso" : "textoSuave"}>
              {r.texto}
            </Texto>
          </View>
        );
      })}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  lista: { gap: t.espaco.xxs, marginTop: -t.espaco.xs, marginBottom: t.espaco.md },
  item: { flexDirection: "row", alignItems: "center", gap: t.espaco.xs },
}));
