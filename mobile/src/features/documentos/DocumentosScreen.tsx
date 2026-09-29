import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusDocumento } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Cabecalho, Campo, Card, Carregando, Chips, EstadoVazio, ItemLista, Pilula, Tela } from "../../components/ui";
import { tempoRelativo } from "../../utils/datas";
import { statusDocumento } from "../../utils/rotulos";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { useFilaDocumentos } from "./api";

const ORDEM: StatusDocumento[] = ["PENDENTE", "EM_ANALISE", "APROVADO", "REPROVADO"];
const PLURAL: Record<StatusDocumento, string> = { PENDENTE: "Pendentes", EM_ANALISE: "Em análise", APROVADO: "Aprovados", REPROVADO: "Reprovados" };

/** Painel de documentos: contagens por status e a fila (mais antigos primeiro). Toque → perfil do aluno. */
export default function DocumentosScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { cores, espaco } = useTema();
  const [status, setStatus] = useState<StatusDocumento>("PENDENTE");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(id);
  }, [busca]);

  const fila = useFilaDocumentos(status, buscaAplicada);
  const c = fila.data?.contagens;

  return (
    <Tela atualizando={fila.isRefetching} onAtualizar={() => fila.refetch()}>
      <Cabecalho titulo="Documentos" subtitulo="Comprovantes de matrícula" onVoltar={() => navegacao.goBack()} />

      <Campo rotulo="Buscar" value={busca} onChangeText={setBusca} placeholder="Nome, matrícula ou universidade" autoCapitalize="none" returnKeyType="search" />
      <View style={{ marginTop: espaco.md, marginBottom: espaco.md }}>
        <Chips opcoes={ORDEM.map((s) => ({ valor: s, rotulo: `${PLURAL[s]} (${c?.[s] ?? 0})` }))} valor={status} onChange={setStatus} />
      </View>

      {fila.isLoading ? (
        <Carregando />
      ) : (
        <Card semPadding>
          {(fila.data?.itens ?? []).map((d, i, arr) => {
            const st = statusDocumento[d.status];
            return (
              <ItemLista
                key={d.id}
                icone={d.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"}
                tomIcone={st.tom}
                titulo={d.aluno.usuario.nome}
                subtitulo={[d.aluno.universidade.nome, d.aluno.matricula ? `Matrícula ${d.aluno.matricula}` : null, `enviado ${tempoRelativo(d.criadoEm)}`]
                  .filter(Boolean)
                  .join(" • ")}
                abaixo={
                  <>
                    <Pilula texto={st.rotulo} tom={st.tom} icone={st.icone} />
                    {d.motivoReprovacao && <Pilula texto={d.motivoReprovacao} tom="neutro" />}
                  </>
                }
                direita={<Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />}
                onPress={() => navegacao.navigate("PerfilAluno", { alunoId: d.aluno.id })}
                ultimo={i === arr.length - 1}
              />
            );
          })}
          {fila.data?.itens.length === 0 && (
            <EstadoVazio
              icone={status === "PENDENTE" ? "checkmark-done-outline" : "document-text-outline"}
              titulo={status === "PENDENTE" ? "Nenhum documento esperando" : `Nenhum documento ${PLURAL[status].toLowerCase()}`}
              texto={status === "PENDENTE" ? "Os comprovantes enviados pelos alunos aparecem aqui." : undefined}
            />
          )}
        </Card>
      )}
    </Tela>
  );
}
