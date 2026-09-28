import React from "react";
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { NomeIcone } from "./icones";

type Variante = "primario" | "secundario" | "perigo" | "fantasma" | "perigoFantasma" | "claro";

interface Props {
  titulo: string;
  onPress: () => void;
  icone?: NomeIcone;
  variante?: Variante;
  /** "grande" (56px) para ações principais do motorista. */
  tamanho?: "normal" | "grande";
  carregando?: boolean;
  desabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Botao({ titulo, onPress, icone, variante = "primario", tamanho = "normal", carregando, desabilitado, style }: Props) {
  const { cores } = useTema();
  const s = useEstilos();

  const aparencia: Record<Variante, { fundo: string; texto: string; borda?: string }> = {
    primario: { fundo: cores.primariaForte, texto: cores.sobrePrimaria },
    secundario: { fundo: cores.primariaSuave, texto: cores.primaria },
    perigo: { fundo: cores.perigoForte, texto: cores.sobrePrimaria },
    fantasma: { fundo: "transparent", texto: cores.primaria },
    perigoFantasma: { fundo: "transparent", texto: cores.perigo },
    // Botão branco para usar sobre o cartão de destaque (marinho)
    claro: { fundo: cores.sobreDestaque, texto: cores.destaque },
  };
  const a = aparencia[variante];
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      style={({ pressed }) => [
        s.base,
        tamanho === "grande" && s.grande,
        { backgroundColor: a.fundo },
        pressed && !inativo && s.pressionado,
        desabilitado && s.desabilitado,
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={a.texto} />
      ) : (
        <View style={s.conteudo}>
          {icone && <Ionicons name={icone} size={tamanho === "grande" ? 22 : 19} color={a.texto} />}
          <Texto variante={tamanho === "grande" ? "subtitulo" : "corpoForte"} cor={a.texto}>
            {titulo}
          </Texto>
        </View>
      )}
    </Pressable>
  );
}

const useEstilos = criarEstilos((t) => ({
  base: { minHeight: 48, borderRadius: t.raio.md, paddingHorizontal: t.espaco.lg, alignItems: "center", justifyContent: "center" },
  grande: { minHeight: 58, borderRadius: t.raio.lg },
  conteudo: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  desabilitado: { opacity: 0.45 },
}));
