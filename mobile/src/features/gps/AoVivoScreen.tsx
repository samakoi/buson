import React, { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Cabecalho, Card, Carregando, EstadoVazio, ItemLista, Pilula, Secao, Tela, Texto } from "../../components/ui";
import { formatarDistancia, haQuantoTempo } from "../../utils/formatos";
import { useAoVivo, useTrajeto } from "./api";
import { DadosMapa } from "./mapaHtml";
import { MapaOSM } from "./MapaOSM";

/** Admin: ônibus em viagem no mapa e o trajeto percorrido de cada um. */
export default function AoVivoScreen() {
  const navegacao = useNavigation();
  const { data: viagens = [], isLoading, refetch, isRefetching } = useAoVivo();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const trajeto = useTrajeto(selecionada);

  const mapa = useMemo<DadosMapa>(() => {
    const visiveis = viagens.filter((v) => v.posicao && (!selecionada || v.id === selecionada));
    return {
      marcadores: visiveis.map((v) => ({ id: v.id, latitude: v.posicao!.latitude, longitude: v.posicao!.longitude, rotulo: `${v.placa} • ${v.rota}`, tipo: "ONIBUS" as const })),
      trajeto: selecionada ? trajeto.data?.pontos.map((p) => [p.latitude, p.longitude] as [number, number]) : undefined,
      ajustar: true,
    };
  }, [viagens, selecionada, trajeto.data]);

  if (isLoading) return <Carregando />;
  const escolhida = viagens.find((v) => v.id === selecionada);

  return (
    <Tela atualizando={isRefetching} onAtualizar={() => refetch()}>
      <Cabecalho titulo="Viagens ao vivo" subtitulo={`${viagens.length} ônibus em viagem`} onVoltar={() => navegacao.goBack()} />

      {viagens.length === 0 ? (
        <Card>
          <EstadoVazio icone="bus-outline" titulo="Nenhum ônibus em viagem agora" texto="Os ônibus aparecem aqui quando o motorista inicia a viagem." />
        </Card>
      ) : (
        <>
          <MapaOSM dados={mapa} altura={340} />
          {escolhida && trajeto.data && (
            <Texto variante="pequeno" cor="textoSuave" style={{ marginTop: 8 }}>
              Trajeto de {escolhida.placa}: {formatarDistancia(trajeto.data.distanciaMetros)} percorridos • toque de novo para ver todos
            </Texto>
          )}
          <Secao titulo="Em viagem" />
          <Card semPadding>
            {viagens.map((v, i) => (
              <ItemLista
                key={v.id}
                icone="bus"
                tomIcone={v.posicao && (v.atualizadoHaSegundos ?? 999) <= 120 ? "sucesso" : "alerta"}
                titulo={`${v.placa} • ${v.sentido === "VOLTA" ? "Volta" : "Ida"} ${v.horario}`}
                subtitulo={`${v.rota} • ${v.motorista} • ${v.embarcados} embarcado(s)`}
                abaixo={
                  <Pilula
                    texto={v.atualizadoHaSegundos == null ? "Sem sinal de GPS" : `Posição ${haQuantoTempo(v.atualizadoHaSegundos)}`}
                    tom={v.atualizadoHaSegundos != null && v.atualizadoHaSegundos <= 120 ? "sucesso" : "alerta"}
                  />
                }
                destacado={v.id === selecionada}
                onPress={() => setSelecionada((atual) => (atual === v.id ? null : v.id))}
                ultimo={i === viagens.length - 1}
              />
            ))}
          </Card>
        </>
      )}
    </Tela>
  );
}
