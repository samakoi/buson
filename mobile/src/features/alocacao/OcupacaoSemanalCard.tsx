import React from "react";
import { View } from "react-native";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { BarraProgresso, Card, Secao, Texto } from "../../components/ui";
import { DIAS_SEMANA_COMPLETOS } from "../../utils/datas";
import { useOcupacaoSemanal } from "./api";
import { OcupacaoDias } from "./ProgramacaoSecao";

/** Dashboard: alunos com dia fixo × lugares, por dia da semana (soma das rotas programadas). */
export function OcupacaoSemanalCard() {
  const { cores } = useTema();
  const s = useEstilos();
  const { data } = useOcupacaoSemanal();
  if (!data || data.dias.length === 0) return null;

  return (
    <>
      <Secao titulo="Ocupação da semana" />
      <Card>
        {data.dias.map((d) => {
          const cheio = d.alocados >= d.capacidade;
          return (
            <View key={d.diaSemana} style={s.linha}>
              <Texto variante="pequenoForte" style={s.dia}>
                {DIAS_SEMANA_COMPLETOS[d.diaSemana].replace("-feira", "")}
              </Texto>
              <View style={{ flex: 1 }}>
                <BarraProgresso valor={d.alocados / Math.max(1, d.capacidade)} cor={cheio ? cores.perigo : cores.primaria} altura={10} />
              </View>
              <Texto variante="pequenoForte" cor={cheio ? "perigo" : "textoSuave"} style={s.numero}>
                {d.alocados}/{d.capacidade}
              </Texto>
            </View>
          );
        })}
        <Texto variante="legenda" cor="textoFraco" style={{ marginTop: 4 }}>
          Alunos com dia fixo ÷ lugares nos ônibus programados
        </Texto>
        {data.rotas.length > 1 &&
          data.rotas.map((r) => (
            <View key={r.rota} style={s.rota}>
              <Texto variante="pequenoForte">{r.rota}</Texto>
              <OcupacaoDias dias={r.dias} />
            </View>
          ))}
      </Card>
    </>
  );
}

const useEstilos = criarEstilos((t) => ({
  linha: { flexDirection: "row", alignItems: "center", gap: t.espaco.md, paddingVertical: t.espaco.xs + 2 },
  dia: { width: 64 },
  numero: { minWidth: 52, textAlign: "right" },
  rota: { marginTop: t.espaco.lg, gap: t.espaco.sm },
}));
