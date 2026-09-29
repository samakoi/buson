import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SituacaoFalta } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Cabecalho, Campo, Card, Carregando, Chips, EstadoVazio, ItemLista, Pilula, Tela } from "../../components/ui";
import { situacaoDaFalta, situacaoFalta } from "../../utils/rotulos";
import { descreverViagem, useFilaFaltas } from "./api";
import { DecisaoFaltaFolha } from "./DecisaoFaltaFolha";

const ORDEM: SituacaoFalta[] = ["AGUARDANDO_DECISAO", "SEM_JUSTIFICATIVA", "JUSTIFICADA", "INDEFERIDA"];
const ROTULO: Record<SituacaoFalta, string> = {
  AGUARDANDO_DECISAO: "Para decidir",
  SEM_JUSTIFICATIVA: "Sem justificativa",
  JUSTIFICADA: "Justificadas",
  INDEFERIDA: "Indeferidas",
};

/** Painel de faltas: justificativas para decidir (mais antigas primeiro) e o histórico por situação. */
export default function FaltasScreen() {
  const navegacao = useNavigation();
  const { espaco } = useTema();
  const [situacao, setSituacao] = useState<SituacaoFalta>("AGUARDANDO_DECISAO");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(id);
  }, [busca]);

  const fila = useFilaFaltas(situacao, buscaAplicada);
  const itens = fila.data?.itens ?? [];
  const selecionada = itens.find((f) => f.id === aberta) ?? null;

  return (
    <Tela atualizando={fila.isRefetching} onAtualizar={() => fila.refetch()}>
      <Cabecalho titulo="Faltas" subtitulo="Justificativas e histórico" onVoltar={() => navegacao.goBack()} />

      <Campo rotulo="Buscar aluno" value={busca} onChangeText={setBusca} placeholder="Nome ou matrícula" autoCapitalize="none" returnKeyType="search" />
      <View style={{ marginTop: espaco.md, marginBottom: espaco.md }}>
        <Chips opcoes={ORDEM.map((s) => ({ valor: s, rotulo: `${ROTULO[s]} (${fila.data?.contagens[s] ?? 0})` }))} valor={situacao} onChange={setSituacao} />
      </View>

      {fila.isLoading ? (
        <Carregando />
      ) : (
        <Card semPadding>
          {itens.map((f, i) => {
            const st = situacaoFalta[situacaoDaFalta(f)];
            return (
              <ItemLista
                key={f.id}
                icone={f.anexoNome ? "attach" : st.icone}
                tomIcone={st.tom}
                titulo={f.aluno.usuario.nome}
                subtitulo={[`${descreverViagem(f.viagem)} • ${f.viagem.rota.nome}`, f.aluno.universidade.nome, f.justificativa ? `“${f.justificativa}”` : null]
                  .filter(Boolean)
                  .join("\n")}
                abaixo={<Pilula texto={st.rotulo} tom={st.tom} />}
                onPress={() => setAberta(f.id)}
                ultimo={i === itens.length - 1}
              />
            );
          })}
          {itens.length === 0 && (
            <EstadoVazio
              icone={situacao === "AGUARDANDO_DECISAO" ? "checkmark-done-outline" : "calendar-clear-outline"}
              titulo={situacao === "AGUARDANDO_DECISAO" ? "Nenhuma justificativa para decidir" : `Nenhuma falta: ${ROTULO[situacao].toLowerCase()}`}
            />
          )}
        </Card>
      )}

      <DecisaoFaltaFolha falta={selecionada} nomeAluno={selecionada?.aluno.usuario.nome ?? ""} onFechar={() => setAberta(null)} />
    </Tela>
  );
}
