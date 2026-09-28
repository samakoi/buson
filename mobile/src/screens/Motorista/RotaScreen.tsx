import React, { useState } from "react";
import { api } from "../../services/api";
import { Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { Cabecalho, Card, Carregando, EstadoVazio, Tela, Texto, Trajeto } from "../../components/ui";

interface PontoRota {
  universidade: string;
  alunosConfirmados: number;
  ativoNoDia: boolean;
}

export default function RotaScreen() {
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [pontos, setPontos] = useState<PontoRota[]>([]);

  const { carregando, atualizando, atualizar } = useCarregamento(
    async () => {
      const { data: atual } = await api.get<Viagem | null>("/viagens/atual");
      setViagem(atual);
      if (atual) {
        const { data } = await api.get<PontoRota[]>(`/viagens/${atual.id}/rota`);
        setPontos(data);
      } else {
        setPontos([]);
      }
    },
    { intervaloMs: 30_000 }
  );

  if (carregando) return <Carregando />;

  const ativas = pontos.filter((p) => p.ativoNoDia).length;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        titulo="Rota do dia"
        subtitulo={viagem ? `${viagem.rota.nome} • ${ativas} de ${pontos.length} paradas ativas` : undefined}
      />

      {pontos.length === 0 ? (
        <Card>
          <EstadoVazio icone="map-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem atribuída a você hoje." />
        </Card>
      ) : (
        <>
          <Card>
            <Trajeto
              riscarInativas={viagem?.status !== "AGUARDANDO"}
              paradas={pontos.map((p) => ({
                nome: p.universidade,
                detalhe: p.ativoNoDia ? `${p.alunosConfirmados} aluno(s) confirmado(s)` : (viagem?.status === "AGUARDANDO" ? "Ninguém confirmado ainda" : "Sem passageiros — pode pular esta parada"),
                ativa: p.ativoNoDia,
              }))}
            />
          </Card>
          <Texto variante="pequeno" cor="textoSuave" alinhar="center">
            Paradas sem alunos confirmados saem do trajeto do dia automaticamente.
          </Texto>
        </>
      )}
    </Tela>
  );
}
