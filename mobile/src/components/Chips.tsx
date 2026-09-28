import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { criarEstilos } from "../theme/TemaProvider";
import { Texto } from "./Texto";

export interface OpcaoChip<T extends string> {
  valor: T;
  rotulo: string;
  detalhe?: string;
  desabilitado?: boolean;
}

/** Seleção única em "pílulas" roláveis — substitui um picker/select. */
export function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
  vazio = "Nenhuma opção cadastrada.",
  quebrarLinha,
}: {
  opcoes: OpcaoChip<T>[];
  valor: T | null;
  onChange: (valor: T) => void;
  vazio?: string;
  /** Em vez de rolar na horizontal, quebra em várias linhas. */
  quebrarLinha?: boolean;
}) {
  const s = useEstilos();
  if (opcoes.length === 0) {
    return (
      <Texto variante="pequeno" cor="textoFraco">
        {vazio}
      </Texto>
    );
  }
  const itens = opcoes.map((o) => {
    const ativo = o.valor === valor;
    return (
      <Pressable
        key={o.valor}
        onPress={() => onChange(o.valor)}
        disabled={o.desabilitado}
        style={({ pressed }) => [s.chip, ativo && s.chipAtivo, o.desabilitado && s.desabilitado, pressed && s.pressionado]}
        accessibilityRole="button"
        accessibilityState={{ selected: ativo, disabled: o.desabilitado }}
      >
        <Texto variante="pequenoForte" cor={ativo ? "sobrePrimaria" : "texto"}>
          {o.rotulo}
        </Texto>
        {o.detalhe ? (
          <Texto variante="legenda" cor={ativo ? "sobrePrimaria" : "textoFraco"} style={ativo && { opacity: 0.85 }}>
            {o.detalhe}
          </Texto>
        ) : null}
      </Pressable>
    );
  });
  if (quebrarLinha) return <View style={s.grade}>{itens}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linha}>
      {itens}
    </ScrollView>
  );
}

const useEstilos = criarEstilos((t) => ({
  linha: { gap: t.espaco.sm, paddingVertical: t.espaco.xxs },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: t.raio.pill,
    borderWidth: 1.5,
    borderColor: t.cores.borda,
    backgroundColor: t.cores.superficie,
    paddingHorizontal: t.espaco.lg,
    paddingVertical: t.espaco.sm - 2,
  },
  chipAtivo: { backgroundColor: t.cores.primariaForte, borderColor: t.cores.primariaForte },
  desabilitado: { opacity: 0.45 },
  pressionado: { opacity: 0.8 },
}));
