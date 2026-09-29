import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { AcompanhamentoViagem, ViagemAoVivo } from "../../types";
import { DadosMapa, MarcadorMapa } from "./mapaHtml";

/** Posição do ônibus da viagem (atualiza a cada 10 s enquanto a tela está aberta). */
export function useAcompanhamento(viagemId: string | undefined) {
  return useQuery({
    queryKey: ["gps", "viagem", viagemId],
    queryFn: async () => (await api.get<AcompanhamentoViagem>(`/viagens/${viagemId}/localizacao`)).data,
    enabled: !!viagemId,
    refetchInterval: 10_000,
  });
}

export function useAoVivo() {
  return useQuery({
    queryKey: ["gps", "ao-vivo"],
    queryFn: async () => (await api.get<ViagemAoVivo[]>("/viagens/ao-vivo")).data,
    refetchInterval: 15_000,
  });
}

export function useTrajeto(viagemId: string | null) {
  return useQuery({
    queryKey: ["gps", "trajeto", viagemId],
    queryFn: async () =>
      (await api.get<{ total: number; distanciaMetros: number; pontos: { latitude: number; longitude: number }[] }>(`/viagens/${viagemId}/trajeto`)).data,
    enabled: !!viagemId,
    refetchInterval: 30_000,
  });
}

/** Ônibus + paradas (o destino do aluno destacado) para o mapa. */
export function dadosDoAcompanhamento(a: AcompanhamentoViagem): DadosMapa {
  const destino = a.meuDestino;
  const marcadores: MarcadorMapa[] = a.paradas.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    rotulo: p.nome,
    tipo: destino && destino.nome === p.nome && destino.tipo === p.tipo ? "DESTINO" : p.tipo,
  }));
  if (a.posicao) marcadores.push({ id: "onibus", latitude: a.posicao.latitude, longitude: a.posicao.longitude, rotulo: a.viagem.placa, tipo: "ONIBUS" });
  return { marcadores };
}
