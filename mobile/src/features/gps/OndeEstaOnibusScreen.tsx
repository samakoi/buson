import React, { useMemo } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme/TemaProvider";
import { Aviso, Botao, Cabecalho, Card, Carregando, Pilula, Tela, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";
import { formatarDistancia, haQuantoTempo } from "../../utils/formatos";
import { dadosDoAcompanhamento, useAcompanhamento } from "./api";
import { MapaOSM } from "./MapaOSM";

const SINAL_ANTIGO_S = 120; // sem posição nova há 2 min: avisa que o sinal está fraco

/** Aluno acompanha o ônibus no mapa: posição, atualização e distância até o seu ponto. */
export default function OndeEstaOnibusScreen() {
  const navegacao = useNavigation();
  const { viagemId } = useRoute().params as { viagemId: string };
  const { cores } = useTema();
  const { data, isLoading, error, refetch, isRefetching } = useAcompanhamento(viagemId);
  const mapa = useMemo(() => (data ? dadosDoAcompanhamento(data) : { marcadores: [] }), [data]);

  if (isLoading) return <Carregando />;
  const voltar = () => navegacao.goBack();

  if (error || !data) {
    return (
      <Tela>
        <Cabecalho titulo="Onde está o ônibus" onVoltar={voltar} />
        <Aviso tipo="erro" titulo={mensagemDeErro(error, "Não foi possível carregar a posição do ônibus.")} />
        <Botao titulo="Tentar de novo" icone="refresh" variante="secundario" onPress={() => refetch()} />
      </Tela>
    );
  }

  const { viagem, posicao, atualizadoHaSegundos: seg, meuDestino } = data;
  const aoVivo = viagem.status === "EM_ANDAMENTO";
  const sinalAntigo = seg != null && seg > SINAL_ANTIGO_S;

  return (
    <Tela atualizando={isRefetching} onAtualizar={() => refetch()}>
      <Cabecalho
        titulo="Onde está o ônibus"
        subtitulo={`${viagem.sentido === "VOLTA" ? "Volta" : "Ida"} • ${viagem.rota} • ${viagem.placa}`}
        onVoltar={voltar}
      />

      <MapaOSM dados={mapa} altura={360} />

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Pilula
            texto={aoVivo ? (posicao ? (sinalAntigo ? "Sinal fraco" : "Ao vivo") : "Aguardando GPS") : viagem.status === "ENCERRADA" ? "Viagem encerrada" : "Ainda não saiu"}
            tom={aoVivo ? (posicao && !sinalAntigo ? "sucesso" : "alerta") : "neutro"}
            icone={aoVivo ? "radio-outline" : "time-outline"}
          />
          {seg != null && aoVivo && (
            <Texto variante="pequeno" cor={sinalAntigo ? "alerta" : "textoSuave"}>
              Atualizado {haQuantoTempo(seg)}
            </Texto>
          )}
        </View>

        {aoVivo && meuDestino?.distanciaMetros != null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
            <Ionicons name="navigate" size={22} color={cores.primaria} />
            <Texto variante="corpoForte" style={{ flex: 1 }}>
              {meuDestino.distanciaMetros < 150
                ? `O ônibus está chegando em ${meuDestino.nome}`
                : `O ônibus está a ${formatarDistancia(meuDestino.distanciaMetros)} de ${meuDestino.nome}`}
            </Texto>
          </View>
        )}
        {aoVivo && !meuDestino && (
          <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 12 }}>
            {viagem.sentido === "IDA"
              ? "Seu ponto de embarque ainda não tem localização cadastrada; acompanhe o ônibus pelo mapa."
              : "Sua instituição ainda não tem localização cadastrada; acompanhe o ônibus pelo mapa."}
          </Texto>
        )}
        {!aoVivo && (
          <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 12 }}>
            {viagem.status === "ENCERRADA"
              ? "A localização é compartilhada só durante a viagem."
              : `O ônibus aparece no mapa assim que o motorista iniciar a viagem (saída ${viagem.horario}).`}
          </Texto>
        )}
        {sinalAntigo && aoVivo && (
          <Texto variante="legenda" cor="textoFraco" style={{ marginTop: 8 }}>
            O celular do motorista está sem internet ou sem GPS agora; a posição volta a atualizar sozinha.
          </Texto>
        )}
      </Card>
    </Tela>
  );
}
