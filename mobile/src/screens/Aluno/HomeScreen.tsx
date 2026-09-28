import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { api } from "../../services/api";
import { MeusDados, Viagem } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificacoes } from "../../contexts/NotificacoesContext";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, BarraProgresso, Botao, Cabecalho, Card, Carregando, EstadoVazio, NomeIcone, Pilula, Secao, Tela, Texto, Trajeto } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { dataPorExtenso, diaISO, formatarDuracao, minutosAte } from "../../utils/datas";
import { statusViagem } from "../../utils/rotulos";
import type { AbasAluno } from "../../navigation/AlunoTabs";

interface PontoRota {
  universidade: string;
  alunosConfirmados: number;
  ativoNoDia: boolean;
}

/** Atualiza a cada minuto para a contagem "sai em…" andar sozinha. */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

export default function AlunoHomeScreen() {
  const { usuario } = useAuth();
  const { atualizar: atualizarAvisos } = useNotificacoes();
  const navegacao = useNavigation<BottomTabNavigationProp<AbasAluno>>();
  const { cores } = useTema();
  const s = useEstilos();
  const agora = useAgora();

  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [pontos, setPontos] = useState<PontoRota[]>([]);
  const [eu, setEu] = useState<MeusDados | null>(null);
  const minhaUniversidade = eu?.universidade.nome ?? null;
  const [processando, setProcessando] = useState(false);

  // Atualiza sozinho: o aluno vê quando o ônibus sai ou quando é promovido da espera
  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(
    async () => {
      const [{ data: v }, { data: dados }] = await Promise.all([
        api.get<Viagem | null>("/viagens/atual"),
        api.get<MeusDados>("/alunos/me"),
      ]);
      setViagem(v);
      setEu(dados);
      if (v) {
        const { data: rota } = await api.get<PontoRota[]>(`/viagens/${v.id}/rota`);
        setPontos(rota);
      } else {
        setPontos([]);
      }
    },
    { intervaloMs: 20_000 }
  );

  async function confirmarPresenca() {
    if (!viagem) return;
    setProcessando(true);
    try {
      const { data } = await api.post<{ status: string }>(`/viagens/${viagem.id}/checkin`);
      if (data.status === "ESPERA") {
        avisar("Lista de espera", "As vagas acabaram, mas você entrou na lista de espera. Avisaremos se uma vaga abrir.");
      }
      await recarregar();
      atualizarAvisos();
    } catch (err) {
      avisar("Não foi possível confirmar", mensagemDeErro(err, "Tente novamente."));
    } finally {
      setProcessando(false);
    }
  }

  async function cancelarPresenca() {
    if (!viagem) return;
    const ok = await confirmar(
      "Cancelar check-in",
      viagem.meuCheckin?.status === "CONFIRMADO"
        ? "Sua vaga será liberada para o próximo da lista de espera."
        : "Você sairá da lista de espera.",
      { textoConfirmar: "Cancelar check-in", destrutivo: true }
    );
    if (!ok) return;
    setProcessando(true);
    try {
      await api.post(`/viagens/${viagem.id}/checkin/cancelar`);
      await recarregar();
      atualizarAvisos();
    } catch (err) {
      avisar("Não foi possível cancelar", mensagemDeErro(err, "Tente novamente."));
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) return <Carregando />;

  const primeiroNome = usuario?.nome.split(" ")[0] ?? "";
  const cabecalho = (
    <>
      <Cabecalho sobrescrito={dataPorExtenso(agora)} titulo={`Olá, ${primeiroNome}`} />
      {eu?.statusConta === "PENDENTE" && (
        <Card>
          <Aviso tipo="info" titulo="Complete seu cadastro" style={{ marginBottom: 0 }}>
            Envie seus dados para validar a matrícula e garantir vaga nos seus dias. Até lá, você pode pedir vagas avulsas.
          </Aviso>
          <Botao titulo="Ir para o Perfil" icone="person-circle-outline" variante="secundario" onPress={() => navegacao.navigate("Perfil")} style={{ marginTop: 12 }} />
        </Card>
      )}
      {eu?.statusConta === "INATIVO" && (
        <Aviso tipo="alerta" titulo="Conta inativa">
          Você não pode usar o transporte no momento. Procure a administração.
        </Aviso>
      )}
    </>
  );

  if (!viagem) {
    return (
      <Tela atualizando={atualizando} onAtualizar={atualizar}>
        {cabecalho}
        <Card>
          <EstadoVazio icone="calendar-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem para a sua universidade hoje. Puxe para baixo para atualizar." />
        </Card>
      </Tela>
    );
  }

  const meu = viagem.meuCheckin;
  const ativo = !!meu && meu.status !== "CANCELADO";
  const lotado = viagem.vagasRestantes === 0;
  const status = statusViagem[viagem.status];

  // Quanto falta para sair
  const minutos = minutosAte(diaISO(new Date(viagem.data)), viagem.horario, agora);
  const quando =
    viagem.status === "ENCERRADA"
      ? "Viagem encerrada"
      : viagem.status === "EM_ANDAMENTO"
        ? "Ônibus a caminho"
        : minutos > 0
          ? `sai em ${formatarDuracao(minutos)}`
          : "saindo agora";

  // Situação do aluno nesta viagem
  const situacao: { texto: string; icone: NomeIcone } = meu?.embarcado
    ? { texto: "Embarque confirmado. Boa viagem!", icone: "checkmark-done-circle" }
    : meu?.status === "CONFIRMADO"
      ? { texto: "Sua vaga está confirmada", icone: "checkmark-circle" }
      : meu?.status === "ESPERA"
        ? { texto: `Você é o ${meu.posicaoFila}º da lista de espera`, icone: "time" }
        : viagem.status === "AGUARDANDO"
          ? { texto: "Você ainda não confirmou presença", icone: "ellipse-outline" }
          : { texto: "Você não fez check-in nesta viagem", icone: "remove-circle-outline" };

  // Ação principal: uma só, a que faz sentido agora
  let acao: React.ReactNode = null;
  if (viagem.status === "AGUARDANDO" && !ativo) {
    acao = (
      <Botao
        titulo={lotado ? "Entrar na lista de espera" : "Confirmar presença"}
        icone={lotado ? "time-outline" : "checkmark-circle"}
        variante="claro"
        onPress={confirmarPresenca}
        carregando={processando}
      />
    );
  } else if (meu?.status === "CONFIRMADO" && !meu.embarcado && viagem.status !== "ENCERRADA") {
    acao = (
      <Botao
        titulo={viagem.status === "EM_ANDAMENTO" ? "Mostrar QR Code para embarcar" : "Ver meu QR Code"}
        icone="qr-code"
        variante="claro"
        onPress={() => navegacao.navigate("QR Code")}
      />
    );
  }

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      {cabecalho}

      {viagem.onibus.emManutencao && viagem.status !== "ENCERRADA" && (
        <Aviso tipo="alerta" titulo={`Ônibus ${viagem.onibus.placa} em manutenção`}>
          {viagem.onibus.observacaoManutencao ?? "A viagem pode atrasar ou ser remanejada. Fique de olho nos avisos."}
        </Aviso>
      )}

      <Card variante="destaque">
        <View style={s.topoCartao}>
          <View style={s.rota}>
            <Ionicons name="bus" size={18} color={cores.sobreDestaque} />
            <Texto variante="corpoForte" cor="sobreDestaque" numberOfLines={1} style={{ flexShrink: 1 }}>
              {viagem.rota.nome}
            </Texto>
          </View>
          <Pilula texto={status.rotulo} icone={status.icone} sobreDestaque />
        </View>

        <View style={s.horarioLinha}>
          <Texto variante="numeroGrande" cor="sobreDestaque">
            {viagem.horario}
          </Texto>
          <Texto variante="corpoForte" cor="sobreDestaqueSuave">
            {quando}
          </Texto>
        </View>
        <Texto variante="pequeno" cor="sobreDestaqueSuave">
          Placa {viagem.onibus.placa}
          {viagem.motorista ? ` • ${viagem.motorista.usuario.nome}` : ""}
        </Texto>

        {viagem.status === "AGUARDANDO" && (
          <View style={s.vagas}>
            <BarraProgresso valor={viagem.resumo.confirmados / Math.max(1, viagem.vagas)} cor={cores.sobreDestaque} fundo="rgba(255,255,255,0.18)" />
            <Texto variante="pequeno" cor="sobreDestaqueSuave">
              {lotado ? `Lotado • ${viagem.resumo.espera} na lista de espera` : `${viagem.vagasRestantes} de ${viagem.vagas} vagas livres`}
            </Texto>
          </View>
        )}

        <View style={s.divisor} />

        <View style={s.situacao}>
          <Ionicons name={situacao.icone} size={20} color={cores.sobreDestaque} />
          <Texto variante="corpoForte" cor="sobreDestaque" style={{ flex: 1 }}>
            {situacao.texto}
          </Texto>
        </View>
        {meu?.status === "ESPERA" && (
          <Texto variante="pequeno" cor="sobreDestaqueSuave" style={{ marginTop: 4 }}>
            Se alguém cancelar, sua vaga é confirmada automaticamente e você recebe um aviso.
          </Texto>
        )}

        {acao && <View style={{ marginTop: 16 }}>{acao}</View>}
      </Card>

      {viagem.status === "AGUARDANDO" && ativo && (
        <Botao titulo="Cancelar check-in" icone="close-circle-outline" variante="perigoFantasma" onPress={cancelarPresenca} carregando={processando} />
      )}
      {viagem.status === "EM_ANDAMENTO" && !ativo && (
        <Texto variante="pequeno" cor="textoSuave" alinhar="center">
          A viagem já começou — o check-in está fechado.
        </Texto>
      )}

      {pontos.length > 0 && (
        <>
          <Secao titulo="Trajeto de hoje" />
          <Card>
            <Trajeto
              riscarInativas={viagem.status !== "AGUARDANDO"}
              paradas={pontos.map((p) => ({
                nome: p.universidade,
                detalhe: p.ativoNoDia ? `${p.alunosConfirmados} aluno(s) confirmado(s)` : (viagem.status === "AGUARDANDO" ? "Ninguém confirmado ainda" : "Sem passageiros hoje"),
                ativa: p.ativoNoDia,
                minha: p.universidade === minhaUniversidade,
              }))}
            />
          </Card>
        </>
      )}
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  topoCartao: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espaco.sm },
  rota: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm, flexShrink: 1 },
  horarioLinha: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: t.espaco.lg, flexWrap: "wrap", gap: t.espaco.sm },
  vagas: { marginTop: t.espaco.lg, gap: t.espaco.sm },
  divisor: { height: 1, backgroundColor: "rgba(255,255,255,0.14)", marginVertical: t.espaco.lg },
  situacao: { flexDirection: "row", alignItems: "center", gap: t.espaco.sm },
}));
