import React from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Campo, Card, ItemOrdenavel, ListaOrdenada, Rotulo, Texto } from "../../components/ui";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { mascararHora } from "../../utils/datas";
import { SentidoViagem } from "../../types";
import type { DadosTrecho } from "../cadastros/api";

/**
 * Um trecho da viagem (ida ou volta): origem, destino, horário de saída e as paradas em ordem.
 * Na ida os alunos embarcam nos pontos e descem nas instituições; na volta, o contrário.
 */
export function EditorTrecho({
  sentido,
  valor,
  onChange,
  horario,
  onHorario,
  universidades,
  pontos,
  extra,
}: {
  sentido: SentidoViagem;
  valor: DadosTrecho;
  onChange: (trecho: DadosTrecho) => void;
  horario: string;
  onHorario: (horario: string) => void;
  universidades: ItemOrdenavel[];
  pontos: ItemOrdenavel[];
  /** Conteúdo extra abaixo do título (ex.: "copiar da ida") */
  extra?: React.ReactNode;
}) {
  const { cores } = useTema();
  const s = useEstilos();
  const ida = sentido === "IDA";
  const instituicoes = (
    <>
      <Rotulo>{ida ? "Instituições (desembarque), na ordem do trajeto" : "Instituições (embarque), na ordem do trajeto"}</Rotulo>
      <ListaOrdenada
        opcoes={universidades}
        selecionados={valor.universidadeIds}
        onChange={(universidadeIds) => onChange({ ...valor, universidadeIds })}
        vazio="Nenhuma instituição cadastrada. Cadastre em Cadastros › Universidades."
        nenhumSelecionado="Adicione ao menos uma instituição."
      />
    </>
  );
  const pontosDoTrecho = (
    <>
      <Rotulo>
        {ida ? "Pontos de embarque, na ordem do trajeto (opcional)" : "Pontos de desembarque, na ordem do trajeto (opcional)"}
      </Rotulo>
      <ListaOrdenada
        opcoes={pontos}
        selecionados={valor.pontosEmbarqueIds}
        onChange={(pontosEmbarqueIds) => onChange({ ...valor, pontosEmbarqueIds })}
        vazio="Nenhum ponto cadastrado (opcional). Cadastre em Cadastros › Pontos."
        nenhumSelecionado={ida ? "Sem pontos de embarque." : "Sem pontos de desembarque."}
      />
    </>
  );

  return (
    <Card style={s.cartao}>
      <View style={s.topo}>
        <View style={[s.selo, { backgroundColor: ida ? cores.primariaSuave : cores.sucessoFundo }]}>
          <Ionicons name={ida ? "arrow-forward" : "arrow-back"} size={18} color={ida ? cores.primaria : cores.sucesso} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto variante="subtitulo">{ida ? "Ida" : "Volta"}</Texto>
          <Texto variante="pequeno" cor="textoSuave" numberOfLines={1}>
            {(valor.origem || "Origem") + " → " + (valor.destino || "Destino") + (horario ? ` • sai ${horario}` : "")}
          </Texto>
        </View>
      </View>
      {extra}

      <View style={s.linha}>
        <View style={s.coluna}>
          <Campo
            rotulo="Origem"
            value={valor.origem}
            onChangeText={(origem) => onChange({ ...valor, origem })}
            placeholder={ida ? "Ex.: Centro" : "Ex.: Instituições"}
            maxLength={80}
          />
        </View>
        <View style={s.coluna}>
          <Campo
            rotulo="Destino"
            value={valor.destino}
            onChangeText={(destino) => onChange({ ...valor, destino })}
            placeholder={ida ? "Ex.: Instituições" : "Ex.: Centro"}
            maxLength={80}
          />
        </View>
      </View>
      <Campo
        rotulo="Horário de saída"
        value={horario}
        onChangeText={(t) => onHorario(mascararHora(t))}
        placeholder="HH:MM"
        keyboardType="number-pad"
        maxLength={5}
      />

      {ida ? (
        <>
          {pontosDoTrecho}
          {instituicoes}
        </>
      ) : (
        <>
          {instituicoes}
          {pontosDoTrecho}
        </>
      )}
    </Card>
  );
}

const useEstilos = criarEstilos((t) => ({
  cartao: { gap: t.espaco.xs },
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.md },
  selo: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  linha: { flexDirection: "row", flexWrap: "wrap", columnGap: t.espaco.md },
  coluna: { flexGrow: 1, flexBasis: 180 },
}));
