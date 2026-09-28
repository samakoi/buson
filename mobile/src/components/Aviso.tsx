import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../theme/TemaProvider";
import { coresDoTom, Tom } from "../theme/tokens";
import { Texto } from "./Texto";
import { NomeIcone } from "./icones";

type TipoAviso = "info" | "alerta" | "erro" | "sucesso";

const config: Record<TipoAviso, { tom: Tom; icone: NomeIcone }> = {
  info: { tom: "info", icone: "information-circle" },
  alerta: { tom: "alerta", icone: "construct" },
  erro: { tom: "perigo", icone: "alert-circle" },
  sucesso: { tom: "sucesso", icone: "checkmark-circle" },
};

/** Faixa colorida com ícone para avisos (manutenção, erros, dicas). */
export function Aviso({
  tipo = "info",
  titulo,
  children,
  style,
}: {
  tipo?: TipoAviso;
  titulo: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { cores } = useTema();
  const s = useEstilos();
  const c = coresDoTom(cores, config[tipo].tom);
  return (
    <View style={[s.aviso, { backgroundColor: c.fundo }, style]} accessibilityRole="alert">
      <Ionicons name={config[tipo].icone} size={20} color={c.cor} style={s.icone} />
      <View style={s.textos}>
        <Texto variante="pequenoForte" cor={c.cor}>
          {titulo}
        </Texto>
        {children ? (
          <Texto variante="pequeno" cor={c.cor}>
            {children}
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  aviso: { flexDirection: "row", gap: t.espaco.md, borderRadius: t.raio.md, padding: t.espaco.md, marginBottom: t.espaco.md },
  icone: { marginTop: 1 },
  textos: { flex: 1, gap: t.espaco.xxs },
}));
