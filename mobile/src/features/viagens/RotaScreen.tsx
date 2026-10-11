import React from "react";
import { useDadosDaTela } from "../../hooks/useDadosDaTela";
import { useRotaDoDia, useViagemAtual } from "./api";
import { Cabecalho, Card, Carregando, EstadoVazio, Secao, Tela, Texto, Trajeto } from "../../components/ui";

export default function RotaScreen() {
  const consultaViagem = useViagemAtual();
  const viagem = consultaViagem.data ?? null;
  const consultaRota = useRotaDoDia(viagem?.id);
  const rota = viagem ? (consultaRota.data ?? null) : null;
  const { carregando, atualizando, atualizar } = useDadosDaTela([consultaViagem, consultaRota], { intervaloMs: 30_000 });

  if (carregando) return <Carregando />;

  const aguardando = viagem?.status === "AGUARDANDO";
  const universidades = rota?.universidades ?? [];
  // Paradas do trecho desta viagem: na ida embarca nos pontos e desce nas instituições;
  // na volta embarca nas instituições e desce nos pontos
  const volta = rota?.sentido === "VOLTA";
  const pontos = rota?.pontosEmbarque ?? [];
  const ativas = universidades.filter((p) => p.ativoNoDia).length;
  const semAlunos = aguardando ? "Ninguém com vaga ainda" : "Sem passageiros — pode pular esta parada";

  const secaoPontos = pontos.length > 0 && (
    <>
      <Secao titulo={volta ? "Pontos de desembarque" : "Pontos de embarque"} />
      <Card>
        <Trajeto
          riscarInativas={!aguardando}
          paradas={pontos.map((p) => ({
            nome: p.nome,
            detalhe: p.ativoNoDia
              ? `${p.alunos} aluno(s) ${volta ? "descem" : "embarcam"} aqui${p.endereco ? ` • ${p.endereco}` : ""}`
              : semAlunos,
            ativa: p.ativoNoDia,
          }))}
        />
      </Card>
    </>
  );
  const secaoInstituicoes = (
    <>
      <Secao titulo={volta ? "Buscar nas instituições" : "Instituições"} />
      <Card>
        <Trajeto
          riscarInativas={!aguardando}
          paradas={universidades.map((p) => ({
            nome: p.universidade,
            detalhe: p.ativoNoDia ? `${p.alunosConfirmados} aluno(s) com vaga` : semAlunos,
            ativa: p.ativoNoDia,
          }))}
        />
      </Card>
    </>
  );

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        titulo="Rota do dia"
        subtitulo={
          viagem
            ? `${viagem.sentido === "VOLTA" ? "Volta" : "Ida"} • ${viagem.rota.nome} • ${ativas} de ${universidades.length} instituições ativas`
            : undefined
        }
      />

      {!viagem || universidades.length === 0 ? (
        <Card>
          <EstadoVazio icone="map-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem atribuída a você hoje." />
        </Card>
      ) : (
        <>
          {volta ? secaoInstituicoes : secaoPontos}
          {volta ? secaoPontos : secaoInstituicoes}
          <Texto variante="pequeno" cor="textoSuave" alinhar="center">
            Paradas sem alunos com vaga saem do trajeto do dia automaticamente.
          </Texto>
        </>
      )}
    </Tela>
  );
}
