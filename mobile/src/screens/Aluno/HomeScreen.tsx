import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../../services/api";
import { MeusDados, RotaDoDia, Viagem } from "../../types";
import { useSessao } from "../../store/sessao";
import { useNotificacoes } from "../../contexts/NotificacoesContext";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, BarraProgresso, Botao, Cabecalho, Card, Carregando, EstadoVazio, NomeIcone, Pilula, Secao, Tela, Texto, Trajeto } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";
import { dataPorExtenso, diaISO, formatarDuracao, minutosAte } from "../../utils/datas";
import { statusViagem } from "../../utils/rotulos";
import type { AbasAluno, PilhaAluno } from "../../navigation/AlunoTabs";
import { LiberarVagaFolha } from "../../features/faltas/LiberarVagaFolha";

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
  const { usuario } = useSessao();
  const { atualizar: atualizarAvisos } = useNotificacoes();
  const navegacao = useNavigation<CompositeNavigationProp<BottomTabNavigationProp<AbasAluno>, NativeStackNavigationProp<PilhaAluno>>>();
  const { cores } = useTema();
  const s = useEstilos();
  const agora = useAgora();

  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [rotaDoDia, setRotaDoDia] = useState<RotaDoDia | null>(null);
  const [eu, setEu] = useState<MeusDados | null>(null);
  const minhaUniversidade = eu?.universidade.nome ?? null;
  const [processando, setProcessando] = useState(false);
  const [liberando, setLiberando] = useState(false);

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
        const { data: rota } = await api.get<RotaDoDia>(`/viagens/${v.id}/rota`);
        setRotaDoDia(rota);
      } else {
        setRotaDoDia(null);
      }
    },
    { intervaloMs: 20_000 }
  );

  async function confirmarPresenca() {
    if (!viagem) return;
    setProcessando(true);
    try {
      const { data } = await api.post<{ status: string }>(`/viagens/${viagem.id}/checkin`);
      if (viagem.meuCheckin?.status === "PROGRAMADO") {
        avisar("Presença confirmada", viagem.sentido === "IDA" ? "Sua ida e sua volta de hoje estão confirmadas." : "Sua volta está confirmada.");
      } else if (data.status === "ESPERA") {
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
    // Quem tem vaga informa o motivo (ausência avisada); quem está na espera só sai da fila
    if (viagem.meuCheckin?.status !== "ESPERA") return setLiberando(true);
    const ok = await confirmar("Sair da lista de espera", "Você sairá da lista de espera desta viagem.", {
      textoConfirmar: "Sair da espera",
      destrutivo: true,
    });
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
      {eu?.statusConta === "PENDENTE" &&
        (eu.pendencias.includes("DOCUMENTO") ? (
          <Card>
            <Aviso
              tipo={eu.documento?.status === "REPROVADO" ? "erro" : "info"}
              titulo={eu.documento?.status === "REPROVADO" ? "Seu documento foi reprovado" : "Valide sua matrícula"}
              style={{ marginBottom: 0 }}
            >
              {eu.documento?.status === "REPROVADO"
                ? `Motivo: ${eu.documento.motivoReprovacao ?? "não informado"}. Envie um novo comprovante.`
                : "Envie o comprovante de matrícula para ativar sua conta e garantir vaga nos seus dias. Até lá, você pode pedir vagas avulsas."}
            </Aviso>
            <Botao titulo="Enviar comprovante" icone="cloud-upload-outline" variante="secundario" onPress={() => navegacao.navigate("Documentacao")} style={{ marginTop: 12 }} />
          </Card>
        ) : (
          <Aviso tipo="info" titulo={eu.documento?.status === "EM_ANALISE" ? "Documento em análise" : "Documento enviado"}>
            Você recebe um aviso assim que a administração validar sua matrícula. Até lá, você pode pedir vagas avulsas.
          </Aviso>
        ))}
      {eu?.statusConta === "INATIVO" && (
        <Aviso tipo="alerta" titulo="Conta inativa">
          Você não pode usar o transporte no momento. Procure a administração.
        </Aviso>
      )}
      {eu?.pendencias.includes("FALTA_A_JUSTIFICAR") && (
        <Card>
          <Aviso tipo="alerta" titulo="Você tem falta para justificar" style={{ marginBottom: 0 }}>
            Você tem 7 dias depois da viagem para explicar o motivo e anexar um atestado, se tiver.
          </Aviso>
          <Botao titulo="Ver minhas faltas" icone="alert-circle-outline" variante="secundario" onPress={() => navegacao.navigate("MinhasFaltas")} style={{ marginTop: 12 }} />
        </Card>
      )}
      {eu?.pendencias.includes("DIAS_DE_USO") && (
        <Card>
          <Aviso tipo="info" titulo="Escolha seus dias de transporte" style={{ marginBottom: 0 }}>
            Com dias fixos, sua vaga fica garantida toda semana — é só confirmar a presença no dia.
          </Aviso>
          <Botao titulo="Escolher meus dias" icone="calendar-outline" variante="secundario" onPress={() => navegacao.navigate("MeusDias")} style={{ marginTop: 12 }} />
        </Card>
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
  const programado = meu?.status === "PROGRAMADO";
  const comVaga = meu?.status === "CONFIRMADO" || programado;
  const volta = viagem.sentido === "VOLTA";
  const pontos = rotaDoDia?.universidades ?? [];
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
      : programado
        ? { texto: "Vaga garantida — confirme sua presença", icone: "calendar" }
      : meu?.status === "ESPERA"
        ? { texto: `Você é o ${meu.posicaoFila}º da lista de espera`, icone: "time" }
        : meu?.motivoAusencia === "FALTOU_NA_IDA" && viagem.status === "AGUARDANDO"
          ? { texto: "Sua vaga na volta foi liberada porque você faltou na ida", icone: "swap-horizontal" }
          : meu?.status === "CANCELADO" && meu.motivoAusencia && viagem.status === "AGUARDANDO"
          ? { texto: "Você avisou que não vai nesta viagem", icone: "calendar-clear-outline" }
          : viagem.status === "AGUARDANDO"
          ? { texto: "Você ainda não confirmou presença", icone: "ellipse-outline" }
          : { texto: "Você não fez check-in nesta viagem", icone: "remove-circle-outline" };

  // Ação principal: uma só, a que faz sentido agora
  let acao: React.ReactNode = null;
  if (viagem.status === "AGUARDANDO" && programado) {
    acao = <Botao titulo="Confirmar presença" icone="checkmark-circle" variante="claro" onPress={confirmarPresenca} carregando={processando} />;
  } else if (viagem.status === "AGUARDANDO" && !ativo) {
    acao = (
      <Botao
        titulo={lotado ? "Entrar na lista de espera" : meu?.motivoAusencia ? "Pedir a vaga de novo" : "Confirmar presença"}
        icone={lotado ? "time-outline" : "checkmark-circle"}
        variante="claro"
        onPress={confirmarPresenca}
        carregando={processando}
      />
    );
  } else if (comVaga && !meu?.embarcado && viagem.status === "EM_ANDAMENTO") {
    // Ônibus saiu: o aluno escaneia o QR exibido pelo motorista
    acao = <Botao titulo="Embarcar" icone="scan" variante="claro" onPress={() => navegacao.navigate("Embarcar")} />;
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
              {volta ? "Volta" : "Ida"} • {viagem.rota.nome}
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
            <BarraProgresso valor={viagem.resumo.ocupados / Math.max(1, viagem.vagas)} cor={cores.sobreDestaque} fundo="rgba(255,255,255,0.18)" />
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
        {comVaga && !volta && meu?.pontoEmbarque && viagem.status !== "ENCERRADA" && (
          <View style={[s.situacao, { marginTop: 8 }]}>
            <Ionicons name="location" size={18} color={cores.sobreDestaqueSuave} />
            <Texto variante="pequenoForte" cor="sobreDestaqueSuave" style={{ flex: 1 }}>
              Embarque em {meu.pontoEmbarque.nome}
            </Texto>
          </View>
        )}
        {programado && viagem.status === "AGUARDANDO" && (
          <Texto variante="pequeno" cor="sobreDestaqueSuave" style={{ marginTop: 4 }}>
            Hoje é um dos seus dias fixos. Confirme para o motorista saber que você vai{volta ? "." : " (vale para a ida e a volta)."}
          </Texto>
        )}
        {meu?.status === "CONFIRMADO" && !meu.embarcado && viagem.status === "AGUARDANDO" && (
          <Texto variante="pequeno" cor="sobreDestaqueSuave" style={{ marginTop: 4 }}>
            Quando o motorista iniciar a viagem, toque em Embarcar e escaneie o QR Code que aparece no celular dele.
          </Texto>
        )}
        {meu?.status === "ESPERA" && (
          <Texto variante="pequeno" cor="sobreDestaqueSuave" style={{ marginTop: 4 }}>
            Se alguém cancelar, sua vaga é confirmada automaticamente e você recebe um aviso.
          </Texto>
        )}

        {acao && <View style={{ marginTop: 16 }}>{acao}</View>}
      </Card>

      {viagem.status === "AGUARDANDO" && ativo && (
        <Botao
          titulo={meu?.status === "ESPERA" ? "Sair da lista de espera" : "Não vou nesta viagem"}
          icone="close-circle-outline"
          variante="perigoFantasma"
          onPress={cancelarPresenca}
          carregando={processando}
        />
      )}
      <LiberarVagaFolha
        viagem={viagem}
        visivel={liberando}
        onFechar={() => setLiberando(false)}
        aoLiberar={async (liberouIrma) => {
          setLiberando(false);
          avisar("Vaga liberada", liberouIrma ? "Suas vagas de ida e volta de hoje foram liberadas. Obrigado por avisar!" : "Obrigado por avisar! Sua vaga foi para outro aluno.");
          await recarregar();
          atualizarAvisos();
        }}
      />
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
                detalhe: p.ativoNoDia ? `${p.alunosConfirmados} aluno(s) com vaga` : (viagem.status === "AGUARDANDO" ? "Ninguém com vaga ainda" : "Sem passageiros hoje"),
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
