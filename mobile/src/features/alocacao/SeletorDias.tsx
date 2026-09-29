import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { BarraProgresso, Texto } from "../../components/ui";
import { DIAS_SEMANA_COMPLETOS } from "../../utils/datas";

export interface DiaDisponivel {
  diaSemana: number;
  capacidade: number;
  /** Lugares já ocupados por outros alunos (sem contar quem está escolhendo) */
  ocupados: number;
  disponiveis: number;
}

/**
 * Lista dos dias em que a rota opera, com as vagas de cada um. Dia lotado fica
 * desabilitado (a menos que já seja do aluno) — ele precisa escolher outro dia.
 */
export function SeletorDias({
  dias,
  selecionados,
  onAlternar,
  desabilitado,
}: {
  dias: DiaDisponivel[];
  selecionados: Set<number>;
  onAlternar: (dia: number) => void;
  desabilitado?: boolean;
}) {
  const { cores } = useTema();
  const s = useEstilos();

  return (
    <View style={s.lista}>
      {dias.map((d, i) => {
        const marcado = selecionados.has(d.diaSemana);
        const lotado = d.disponiveis === 0 && !marcado;
        const ocupadosComigo = d.ocupados + (marcado ? 1 : 0);
        const livres = d.capacidade - ocupadosComigo;
        const bloqueado = desabilitado || lotado;
        const detalhe = lotado ? "Lotado — escolha outro dia" : marcado ? "Seu dia" : `${livres} ${livres === 1 ? "vaga livre" : "vagas livres"}`;
        return (
          <Pressable
            key={d.diaSemana}
            onPress={() => onAlternar(d.diaSemana)}
            disabled={bloqueado}
            style={({ pressed }) => [s.linha, i < dias.length - 1 && s.separador, marcado && s.marcado, pressed && s.pressionado]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado, disabled: bloqueado }}
            accessibilityLabel={`${DIAS_SEMANA_COMPLETOS[d.diaSemana]}: ${detalhe}, ${ocupadosComigo} de ${d.capacidade} lugares ocupados`}
          >
            <View style={[s.caixa, marcado && s.caixaMarcada, lotado && s.caixaLotada]}>
              {marcado && <Ionicons name="checkmark" size={18} color={cores.sobrePrimaria} />}
              {lotado && <Ionicons name="lock-closed" size={14} color={cores.textoFraco} />}
            </View>
            <View style={s.textos}>
              <View style={s.topo}>
                <Texto variante="corpoForte" cor={lotado ? "textoFraco" : "texto"}>
                  {DIAS_SEMANA_COMPLETOS[d.diaSemana]}
                </Texto>
                <Texto variante="pequenoForte" cor={lotado ? "perigo" : marcado ? "primaria" : "textoSuave"}>
                  {ocupadosComigo}/{d.capacidade}
                </Texto>
              </View>
              <BarraProgresso
                valor={ocupadosComigo / Math.max(1, d.capacidade)}
                cor={lotado ? cores.perigo : livres <= Math.ceil(d.capacidade * 0.1) ? cores.alerta : cores.primaria}
                altura={6}
              />
              <Texto variante="legenda" cor={lotado ? "perigo" : "textoFraco"}>
                {detalhe}
              </Texto>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  lista: { borderRadius: t.raio.lg, borderWidth: 1, borderColor: t.cores.borda, backgroundColor: t.cores.superficie, overflow: "hidden" },
  linha: { flexDirection: "row", alignItems: "center", gap: t.espaco.md, paddingHorizontal: t.espaco.lg, paddingVertical: t.espaco.md, minHeight: 64 },
  separador: { borderBottomWidth: 1, borderBottomColor: t.cores.borda },
  marcado: { backgroundColor: t.cores.primariaSuave },
  pressionado: { opacity: 0.85 },
  caixa: {
    width: 28,
    height: 28,
    borderRadius: t.raio.sm,
    borderWidth: 2,
    borderColor: t.cores.bordaForte,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.cores.superficie,
  },
  caixaMarcada: { backgroundColor: t.cores.primariaForte, borderColor: t.cores.primariaForte },
  caixaLotada: { borderColor: t.cores.borda, backgroundColor: t.cores.superficieAlt },
  textos: { flex: 1, gap: t.espaco.xs },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: t.espaco.sm },
}));
