import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { coresDoTom, Tom } from "../theme/tokens";
import { Texto } from "./Texto";
import { NomeIcone } from "./icones";

/**
 * Linha de lista (mín. 56px): ícone ou avatar à esquerda, título/subtítulo e um
 * elemento opcional à direita. Use dentro de um <Card semPadding>.
 */
export function ItemLista({
  titulo,
  subtitulo,
  icone,
  tomIcone = "info",
  iniciais,
  direita,
  abaixo,
  onPress,
  ultimo,
  apagado,
  destacado,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: NomeIcone;
  tomIcone?: Tom;
  /** Mostra um avatar com iniciais no lugar do ícone. */
  iniciais?: string;
  direita?: React.ReactNode;
  /** Conteúdo extra sob o subtítulo (ex.: pílulas de status) — evita apertar o texto à direita. */
  abaixo?: React.ReactNode;
  onPress?: () => void;
  ultimo?: boolean;
  apagado?: boolean;
  destacado?: boolean;
}) {
  const { cores } = useTema();
  const s = useEstilos();
  const c = coresDoTom(cores, tomIcone);
  const conteudo = (
    <>
      {(icone || iniciais) && (
        <View style={[s.icone, { backgroundColor: c.fundo }]}>
          {iniciais ? (
            <Texto variante="pequenoForte" cor={c.cor}>
              {iniciais}
            </Texto>
          ) : (
            <Ionicons name={icone!} size={19} color={c.cor} />
          )}
        </View>
      )}
      <View style={s.textos}>
        <Texto variante="corpoForte" numberOfLines={2}>
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto variante="pequeno" cor="textoSuave" numberOfLines={3}>
            {subtitulo}
          </Texto>
        ) : null}
        {abaixo ? <View style={s.abaixo}>{abaixo}</View> : null}
      </View>
      {direita}
    </>
  );
  const estilo = [s.item, !ultimo && s.separador, apagado && s.apagado, destacado && s.destacado];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...estilo, pressed && s.pressionado]}>
        {conteudo}
      </Pressable>
    );
  }
  return <View style={estilo}>{conteudo}</View>;
}

const useEstilos = criarEstilos((t) => ({
  item: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: t.espaco.md, paddingHorizontal: t.espaco.lg, paddingVertical: t.espaco.md },
  separador: { borderBottomWidth: 1, borderBottomColor: t.cores.borda },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, gap: t.espaco.xxs },
  abaixo: { flexDirection: "row", flexWrap: "wrap", gap: t.espaco.xs, marginTop: t.espaco.xs },
  apagado: { opacity: 0.55 },
  destacado: { backgroundColor: t.cores.primariaSuave },
  pressionado: { backgroundColor: t.cores.superficieAlt },
}));
