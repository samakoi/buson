import React from "react";
import { View } from "react-native";
import { criarEstilos } from "../theme/TemaProvider";
import { Texto } from "./Texto";
import { Pilula } from "./Pilula";

export interface ParadaTrajeto {
  nome: string;
  detalhe?: string;
  ativa: boolean;
  /** Parada do usuário (a universidade do aluno). */
  minha?: boolean;
}

/** Linha do tempo vertical com as paradas da rota do dia. */
export function Trajeto({
  paradas,
  riscarInativas = true,
}: {
  paradas: ParadaTrajeto[];
  /** Antes da saída as paradas vazias ainda podem ganhar alunos: aí não risca. */
  riscarInativas?: boolean;
}) {
  const s = useEstilos();
  return (
    <View>
      {paradas.map((p, i) => {
        const ultima = i === paradas.length - 1;
        return (
          <View key={`${p.nome}-${i}`} style={s.linha}>
            <View style={s.trilho}>
              <View style={[s.ponto, p.ativa ? s.pontoAtivo : s.pontoInativo]} />
              {!ultima && <View style={s.conector} />}
            </View>
            <View style={[s.textos, !ultima && s.espacoAbaixo, !p.ativa && s.inativa]}>
              <View style={s.tituloLinha}>
                <Texto variante="corpoForte" style={!p.ativa && riscarInativas && s.riscado}>
                  {p.nome}
                </Texto>
                {p.minha && <Pilula texto="Sua parada" tom="info" />}
              </View>
              {p.detalhe ? (
                <Texto variante="pequeno" cor="textoSuave">
                  {p.detalhe}
                </Texto>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  linha: { flexDirection: "row", gap: t.espaco.md },
  trilho: { width: 16, alignItems: "center" },
  ponto: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 3 },
  pontoAtivo: { backgroundColor: t.cores.primaria, borderColor: t.cores.primariaSuave },
  pontoInativo: { backgroundColor: t.cores.superficie, borderColor: t.cores.bordaForte },
  conector: { flex: 1, width: 2, backgroundColor: t.cores.borda, marginVertical: 2 },
  textos: { flex: 1, gap: t.espaco.xxs },
  espacoAbaixo: { paddingBottom: t.espaco.lg },
  tituloLinha: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm, flexWrap: "wrap" },
  inativa: { opacity: 0.6 },
  riscado: { textDecorationLine: "line-through" },
}));
