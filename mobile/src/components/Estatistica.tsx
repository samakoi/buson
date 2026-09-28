import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { coresDoTom, elevacao, Tom } from "../theme/tokens";
import { Texto } from "./Texto";
import { NomeIcone } from "./icones";

/** Bloco rótulo + número. Use dentro de <GradeEstatisticas>. */
export function Estatistica({
  rotulo,
  valor,
  tom = "neutro",
  icone,
  compacta,
}: {
  rotulo: string;
  valor: string | number;
  tom?: Tom;
  icone?: NomeIcone;
  compacta?: boolean;
}) {
  const { cores } = useTema();
  const s = useEstilos();
  const c = coresDoTom(cores, tom);
  const corValor = tom === "neutro" ? cores.texto : c.cor;
  return (
    <View style={[s.bloco, compacta && s.compacta]}>
      <View style={s.topo}>
        {icone && <Ionicons name={icone} size={15} color={tom === "neutro" ? cores.textoFraco : c.cor} />}
        <Texto variante="legenda" cor="textoSuave" numberOfLines={1} style={{ flexShrink: 1 }}>
          {rotulo}
        </Texto>
      </View>
      <Texto variante={compacta ? "numeroMedio" : "numero"} cor={corValor}>
        {valor}
      </Texto>
    </View>
  );
}

/** Grade de estatísticas com `colunas` por linha. */
export function GradeEstatisticas({ children, colunas = 2 }: { children: React.ReactNode; colunas?: 2 | 3 }) {
  const s = useEstilos();
  return (
    <View style={s.grade}>
      {React.Children.toArray(children).map((filho, i) => (
        <View key={i} style={{ width: colunas === 2 ? "48.5%" : "31.5%", flexGrow: 1 }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  grade: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm, marginBottom: t.espaco.md },
  bloco: { backgroundColor: t.cores.superficie, borderRadius: t.raio.md, padding: t.espaco.md, gap: t.espaco.xs, ...elevacao(t.cores, t.escuro) },
  compacta: { padding: t.espaco.sm + 2 },
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.xs },
}));
