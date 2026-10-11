import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Rota } from "../../types";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { useExcluirRota, useRotas } from "./api";
import { useTema } from "../../theme/TemaProvider";
import { BotaoIcone, Card, Carregando, EstadoVazio, ItemLista } from "../../components/ui";
import { BarraSecao } from "./BarraSecao";

const resumoTrecho = (nome: string, t: Rota["trechos"]["ida"]) =>
  `${nome}: ${t.origem} → ${t.destino}` + (t.instituicoes.length ? ` (${t.instituicoes.map((p) => p.universidade.nome).join(", ")})` : "");

/**
 * Rotas cadastradas, cada uma com a ida e a volta. Criar e editar usam a mesma tela da viagem
 * (a rota é gerenciada dentro dela); daqui dá para salvar só a rota, sem programar a viagem.
 */
export default function RotasCadastro() {
  const { cores } = useTema();
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const consultaRotas = useRotas();
  const rotas = consultaRotas.data ?? [];
  const { carregando } = useDadosDaTela(consultaRotas);
  const { excluir } = useExcluirRota();

  const abrir = (r?: Rota) => navegacao.navigate("EditarViagem", r ? { rotaId: r.id, soRota: true } : { soRota: true });

  if (carregando) return <Carregando />;

  return (
    <View>
      <BarraSecao texto={`${rotas.length} rota(s)`} onAdicionar={() => abrir()} />

      <Card semPadding>
        {rotas.map((r, i) => (
          <ItemLista
            key={r.id}
            icone="swap-horizontal-outline"
            titulo={r.nome}
            subtitulo={`${resumoTrecho("Ida", r.trechos.ida)}\n${resumoTrecho("Volta", r.trechos.volta)}`}
            ultimo={i === rotas.length - 1}
            direita={
              <View style={{ flexDirection: "row" }}>
                <BotaoIcone icone="create-outline" rotulo={`Editar ${r.nome}`} onPress={() => abrir(r)} />
                <BotaoIcone icone="trash-outline" rotulo={`Excluir ${r.nome}`} cor={cores.perigo} onPress={() => excluir(r)} />
              </View>
            }
          />
        ))}
        {rotas.length === 0 && (
          <EstadoVazio
            icone="map-outline"
            titulo="Nenhuma rota"
            texto="As rotas também são criadas junto com a viagem, em Viagens › Programação semanal."
            acao={{ titulo: "Adicionar rota", icone: "add", onPress: () => abrir() }}
          />
        )}
      </Card>
    </View>
  );
}
