import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../../services/api";
import { PerfilAlunoAdmin, StatusConta } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Botao, Cabecalho, Campo, Card, Carregando, EstadoVazio, Folha, ItemLista, Pilula, Secao, Tela, Texto, iniciaisDe } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { formatarTelefone } from "../../utils/formatos";
import { DIAS_SEMANA_COMPLETOS, formatarDiaBR, diaISO, tempoRelativo } from "../../utils/datas";
import { acaoAuditoria, motivoAusencia, mudancaAuditoria, rotuloValorAuditoria, situacaoDaFalta, situacaoFalta, statusConta } from "../../utils/rotulos";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { DocumentosDoAluno } from "../../features/documentos/DocumentosDoAluno";
import { DecisaoFaltaFolha } from "../../features/faltas/DecisaoFaltaFolha";
import { tituloViagem } from "../../features/faltas/api";

export default function PerfilAlunoScreen() {
  const navegacao = useNavigation<NativeStackNavigationProp<PilhaAdmin>>();
  const { alunoId } = useRoute<RouteProp<PilhaAdmin, "PerfilAluno">>().params;
  const { cores } = useTema();
  const s = useEstilos();
  const [aluno, setAluno] = useState<PerfilAlunoAdmin | null>(null);
  const [inativarAberto, setInativarAberto] = useState(false);
  const [faltaAberta, setFaltaAberta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(async () => {
    const { data } = await api.get<PerfilAlunoAdmin>(`/alunos/${alunoId}`);
    setAluno(data);
  });

  async function alterarStatus(status: StatusConta, motivoTexto?: string) {
    setSalvando(true);
    try {
      const { data } = await api.patch<PerfilAlunoAdmin>(`/alunos/${alunoId}/status`, { status, motivo: motivoTexto || undefined });
      setAluno(data);
      setInativarAberto(false);
      setMotivo("");
    } catch (err) {
      avisar("Não foi possível alterar", mensagemDeErro(err, "Tente novamente."));
    } finally {
      setSalvando(false);
    }
  }

  async function ativar() {
    if (!aluno) return;
    const ok = await confirmar("Ativar conta", `Ativar a conta de ${aluno.usuario.nome}? O aluno será avisado e poderá usar o transporte.`, { textoConfirmar: "Ativar" });
    if (ok) alterarStatus("ATIVO");
  }

  if (carregando || !aluno) return <Carregando />;

  const st = statusConta[aluno.statusConta];

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo={aluno.usuario.nome} subtitulo={aluno.universidade.nome} onVoltar={() => navegacao.goBack()} />

      <Card>
        <View style={s.topo}>
          <View style={s.avatar}>
            <Texto variante="titulo" cor="primaria">
              {iniciaisDe(aluno.usuario.nome)}
            </Texto>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Pilula texto={st.conta} tom={st.tom} icone={st.icone} />
            <Texto variante="pequeno" cor="textoSuave">
              Cadastrado em {formatarDiaBR(diaISO(new Date(aluno.criadoEm)))}
            </Texto>
          </View>
        </View>
        <View style={s.acoes}>
          {aluno.statusConta !== "ATIVO" && <Botao titulo="Ativar conta" icone="checkmark-circle" onPress={ativar} carregando={salvando} style={{ flex: 1 }} />}
          {aluno.statusConta !== "INATIVO" && (
            <Botao titulo="Inativar" icone="pause-circle-outline" variante="secundario" onPress={() => setInativarAberto(true)} style={{ flex: 1 }} />
          )}
        </View>
      </Card>

      <Secao titulo="Dados" />
      <Card semPadding>
        <ItemLista icone="mail-outline" tomIcone="neutro" titulo={aluno.usuario.email} subtitulo="E-mail" />
        <ItemLista icone="call-outline" tomIcone="neutro" titulo={formatarTelefone(aluno.telefone)} subtitulo="Telefone" />
        <ItemLista icone="card-outline" tomIcone="neutro" titulo={aluno.matricula ?? "Não informada"} subtitulo="Matrícula" />
        <ItemLista icone="school-outline" tomIcone="neutro" titulo={aluno.curso ?? "Não informado"} subtitulo="Curso" ultimo />
      </Card>

      <DocumentosDoAluno documentos={aluno.documentos} nome={aluno.usuario.nome} statusConta={aluno.statusConta} aoMudar={recarregar} />

      <Secao
        titulo="Dias de uso"
        acao={aluno.statusConta === "ATIVO" ? { texto: "Editar", onPress: () => navegacao.navigate("DiasAluno", { alunoId, nome: aluno.usuario.nome }) } : undefined}
      />
      <Card semPadding>
        {aluno.dias.map((d, i) => (
          <ItemLista
            key={d.diaSemana}
            icone="calendar-outline"
            tomIcone="info"
            titulo={DIAS_SEMANA_COMPLETOS[d.diaSemana]}
            subtitulo={`${d.rota.nome}${d.pontoEmbarque ? ` • embarca em ${d.pontoEmbarque.nome}` : ""}`}
            ultimo={i === aluno.dias.length - 1}
          />
        ))}
        {aluno.dias.length === 0 && (
          <ItemLista
            icone="calendar-clear-outline"
            tomIcone="neutro"
            titulo="Sem dias fixos"
            subtitulo={aluno.statusConta === "ATIVO" ? "Toque para escolher os dias do aluno" : "Só contas ativas têm dias fixos"}
            direita={aluno.statusConta === "ATIVO" ? <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} /> : undefined}
            onPress={aluno.statusConta === "ATIVO" ? () => navegacao.navigate("DiasAluno", { alunoId, nome: aluno.usuario.nome }) : undefined}
            ultimo
          />
        )}
      </Card>

      <Secao titulo={`Faltas${aluno.faltas.length ? ` (${aluno.faltas.length})` : ""}`} />
      <Card semPadding>
        {aluno.faltas.map((f, i) => {
          const st = situacaoFalta[situacaoDaFalta(f)];
          return (
            <ItemLista
              key={f.id}
              icone={f.anexoNome ? "attach" : st.icone}
              tomIcone={st.tom}
              titulo={tituloViagem(f.viagem)}
              subtitulo={[f.viagem.rota.nome, f.justificativa ? `“${f.justificativa}”` : null].filter(Boolean).join("\n")}
              abaixo={<Pilula texto={st.rotulo} tom={st.tom} />}
              onPress={() => setFaltaAberta(f.id)}
              ultimo={i === aluno.faltas.length - 1 && aluno.ausenciasAvisadas.length === 0}
            />
          );
        })}
        {aluno.ausenciasAvisadas.slice(0, 5).map((a, i, arr) => (
          <ItemLista
            key={a.id}
            icone="calendar-clear-outline"
            tomIcone="neutro"
            titulo={tituloViagem(a.viagem)}
            subtitulo={a.motivoAusencia === "FALTOU_NA_IDA" ? motivoAusencia[a.motivoAusencia] : `Ausência avisada: ${motivoAusencia[a.motivoAusencia]}`}
            ultimo={i === arr.length - 1}
          />
        ))}
        {aluno.faltas.length === 0 && aluno.ausenciasAvisadas.length === 0 && <EstadoVazio icone="checkmark-done-outline" titulo="Nenhuma falta" />}
      </Card>
      <DecisaoFaltaFolha
        key={faltaAberta ?? "nenhuma"}
        falta={aluno.faltas.find((f) => f.id === faltaAberta) ?? null}
        nomeAluno={aluno.usuario.nome}
        onFechar={() => setFaltaAberta(null)}
        aoDecidir={recarregar}
      />

      <Secao titulo="Histórico" />
      <Card semPadding>
        {aluno.historico.map((h, i) => {
          const d = h.detalhes as { de?: string; para?: string; motivo?: string | null; viagem?: string } | null;
          const mudanca = d?.de && d?.para ? `${rotuloValorAuditoria(d.de)} → ${rotuloValorAuditoria(d.para)}` : mudancaAuditoria(h);
          return (
            <ItemLista
              key={h.id}
              icone="time-outline"
              tomIcone="neutro"
              titulo={acaoAuditoria[h.acao] ?? h.acao}
              subtitulo={[mudanca, d?.viagem ? `Falta na ${d.viagem}` : null, d?.motivo, `${h.usuario ? h.usuario.nome : "Sistema"} • ${tempoRelativo(h.criadoEm)}`]
                .filter(Boolean)
                .join("\n")}
              ultimo={i === aluno.historico.length - 1}
            />
          );
        })}
        {aluno.historico.length === 0 && <EstadoVazio icone="time-outline" titulo="Sem registros ainda" />}
      </Card>

      <Folha visivel={inativarAberto} onFechar={() => setInativarAberto(false)} titulo="Inativar conta">
        <Texto variante="pequeno" cor="textoSuave">
          O aluno não poderá usar o transporte enquanto estiver inativo e deixa de ocupar vagas. Ele será avisado.
        </Texto>
        <Campo rotulo="Motivo (opcional)" value={motivo} onChangeText={setMotivo} placeholder="Ex.: trancou o semestre" maxLength={200} />
        <Botao titulo="Inativar conta" icone="pause-circle" variante="perigo" onPress={() => alterarStatus("INATIVO", motivo.trim())} carregando={salvando} style={{ marginTop: 24 }} />
      </Folha>
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  topo: { flexDirection: "row", alignItems: "center", gap: t.espaco.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.cores.primariaSuave, alignItems: "center", justifyContent: "center" },
  acoes: { flexDirection: "row", gap: t.espaco.sm, marginTop: t.espaco.lg },
}));
