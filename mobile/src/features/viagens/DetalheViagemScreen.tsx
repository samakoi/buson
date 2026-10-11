import React, { useMemo } from "react";
import { View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  Aviso,
  Cabecalho,
  Card,
  Carregando,
  EstadoVazio,
  Estatistica,
  GradeEstatisticas,
  ItemLista,
  Pilula,
  Secao,
  Tela,
  Texto,
  iniciaisDe,
} from "../../components/ui";
import type { PilhaAdmin } from "../../navigation/AdminTabs";
import { PassageiroHistorico } from "../../types";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { diaISO, formatarDiaBR, formatarDiaCurto, formatarHora } from "../../utils/datas";
import { formatarDistancia } from "../../utils/formatos";
import { mensagemDeErro } from "../../utils/feedback";
import { motivoAusencia, situacaoPassageiro, statusViagem } from "../../utils/rotulos";
import { useTrajeto } from "../gps/api";
import { DadosMapa } from "../gps/mapaHtml";
import { MapaOSM } from "../gps/MapaOSM";
import { useDetalheViagem } from "./api";

/** Admin: uma viagem do histórico — horários, números, passageiros e o trajeto no mapa. */
export default function DetalheViagemScreen() {
  const navegacao = useNavigation();
  const { viagemId } = useRoute<RouteProp<PilhaAdmin, "DetalheViagem">>().params;
  const consulta = useDetalheViagem(viagemId);
  const { carregando, atualizando, atualizar } = useDadosDaTela(consulta);
  const detalhe = consulta.data;
  const encerrada = detalhe?.viagem.status === "ENCERRADA";
  const trajeto = useTrajeto(detalhe && detalhe.gps.pontos > 0 ? viagemId : null, { atualizar: !encerrada });

  const mapa = useMemo<DadosMapa | null>(() => {
    const pontos = trajeto.data?.pontos ?? [];
    if (pontos.length === 0) return null;
    const ultimo = pontos[pontos.length - 1];
    return {
      marcadores: [
        {
          id: "onibus",
          latitude: ultimo.latitude,
          longitude: ultimo.longitude,
          rotulo: encerrada ? "Fim do trajeto" : "Posição atual",
          tipo: "ONIBUS",
        },
      ],
      trajeto: pontos.map((p) => [p.latitude, p.longitude] as [number, number]),
      ajustar: true,
    };
  }, [trajeto.data, encerrada]);

  if (carregando) return <Carregando />;
  if (!detalhe) {
    return (
      <Tela>
        <Cabecalho titulo="Viagem" onVoltar={() => navegacao.goBack()} />
        <Aviso tipo="erro" titulo={mensagemDeErro(consulta.error, "Não foi possível carregar a viagem.")} />
      </Tela>
    );
  }

  const { viagem, resumo, passageiros } = detalhe;
  const st = statusViagem[viagem.status];
  const dia = diaISO(new Date(viagem.data));

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        sobrescrito={`${formatarDiaCurto(dia)} • ${viagem.horario}`}
        titulo={`${viagem.sentido === "VOLTA" ? "Volta" : "Ida"} • ${viagem.rota.nome}`}
        onVoltar={() => navegacao.goBack()}
      />

      <Card>
        <ItemLista
          icone="bus-outline"
          titulo={viagem.onibus.placa}
          subtitulo={`Motorista: ${viagem.motorista?.usuario.nome ?? "—"}`}
          ultimo
        />
        <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 8 }}>
          {formatarDiaBR(dia)} • saída prevista {viagem.horario}
          {viagem.iniciadaEm ? ` • iniciada ${formatarHora(viagem.iniciadaEm)}` : ""}
          {viagem.encerradaEm ? ` • encerrada ${formatarHora(viagem.encerradaEm)}` : ""}
        </Texto>
        {encerrada && !viagem.encerradaEm && (
          <Texto variante="pequeno" cor="textoSuave">
            Horários de início e fim não registrados (viagem anterior a esse controle).
          </Texto>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <Pilula texto={st.rotulo} tom={st.tom} />
          <Pilula texto={viagem.avulsa ? "Avulsa" : "Programada"} tom="info" icone={viagem.avulsa ? undefined : "repeat"} />
        </View>
      </Card>

      <Secao titulo="Números" />
      <GradeEstatisticas colunas={3}>
        <Estatistica compacta rotulo="Vagas" valor={resumo.vagas} />
        <Estatistica compacta rotulo="Embarcaram" valor={resumo.embarcaram} tom="sucesso" />
        <Estatistica compacta rotulo="Faltaram" valor={resumo.faltaram} tom={resumo.faltaram ? "perigo" : "neutro"} />
        <Estatistica compacta rotulo="Avisaram" valor={resumo.ausenciasAvisadas} tom="info" />
        <Estatistica compacta rotulo="Na espera" valor={resumo.espera} tom={resumo.espera ? "alerta" : "neutro"} />
        <Estatistica compacta rotulo={encerrada ? "Cancelaram" : "Com vaga"} valor={encerrada ? resumo.cancelaram : resumo.previstos} />
      </GradeEstatisticas>

      <Secao titulo="Trajeto" />
      {mapa ? (
        <>
          <MapaOSM dados={mapa} altura={280} />
          {trajeto.data && (
            <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 8 }}>
              {formatarDistancia(trajeto.data.distanciaMetros)} percorridos • {trajeto.data.total} posições de GPS
            </Texto>
          )}
        </>
      ) : (
        <Card>
          <EstadoVazio
            icone="map-outline"
            titulo="Sem trajeto registrado"
            texto="O trajeto aparece quando o motorista compartilha o GPS durante a viagem. As posições são guardadas por tempo limitado."
          />
        </Card>
      )}

      <Secao titulo={`Passageiros (${passageiros.length})`} />
      <Card semPadding>
        {passageiros.length === 0 ? (
          <EstadoVazio icone="people-outline" titulo="Nenhum aluno nesta viagem" />
        ) : (
          passageiros.map((p, i) => <LinhaPassageiro key={p.alunoId} p={p} ultimo={i === passageiros.length - 1} />)
        )}
      </Card>
    </Tela>
  );
}

function LinhaPassageiro({ p, ultimo }: { p: PassageiroHistorico; ultimo: boolean }) {
  const sit = situacaoPassageiro[p.situacao];
  const detalhes = [p.universidade, p.pontoEmbarque && `embarque em ${p.pontoEmbarque}`].filter(Boolean).join(" • ");
  const extra =
    p.situacao === "EMBARCOU" && p.embarqueEm
      ? `${formatarHora(p.embarqueEm)} • ${p.metodoEmbarque === "MANUAL" ? "confirmado pelo motorista" : "QR Code"}`
      : p.situacao === "AUSENCIA_AVISADA" && p.motivoAusencia
        ? motivoAusencia[p.motivoAusencia]
        : p.situacao === "FALTOU" && p.falta
          ? p.falta.status === "JUSTIFICADA"
            ? "falta justificada"
            : p.falta.status === "INDEFERIDA"
              ? "justificativa indeferida"
              : p.falta.justificada
                ? "justificativa em análise"
                : "sem justificativa"
          : null;
  return (
    <ItemLista
      iniciais={iniciaisDe(p.nome)}
      titulo={p.nome}
      subtitulo={detalhes}
      abaixo={
        <>
          <Pilula texto={sit.rotulo} tom={sit.tom} icone={sit.icone} />
          {extra && (
            <Texto variante="pequeno" cor="textoSuave">
              {extra}
            </Texto>
          )}
        </>
      }
      ultimo={ultimo}
    />
  );
}
