import React, { useState } from "react";
import { api } from "../../services/api";
import { Onibus, Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { Aviso, Cabecalho, Card, Carregando, EstadoVazio, ItemLista, Pilula, Secao, Tela, Texto } from "../../components/ui";
import { statusManutencao, statusViagem } from "../../utils/rotulos";

type StatusFrota = Pick<Onibus, "id" | "placa" | "emManutencao" | "observacaoManutencao">;

/** Situação do ônibus da viagem de hoje e de toda a frota (manutenção). */
export default function OnibusScreen() {
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [frota, setFrota] = useState<StatusFrota[]>([]);

  const { carregando, atualizando, atualizar } = useCarregamento(
    async () => {
      const [{ data: v }, { data: f }] = await Promise.all([
        api.get<Viagem | null>("/viagens/atual"),
        api.get<StatusFrota[]>("/onibus/status"),
      ]);
      setViagem(v);
      setFrota(f);
    },
    { intervaloMs: 30_000 }
  );

  if (carregando) return <Carregando />;

  const situacao = viagem ? statusViagem[viagem.status] : null;
  const manutencao = viagem ? statusManutencao(viagem.onibus.emManutencao) : null;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho titulo="Ônibus" subtitulo="Situação do seu ônibus e da frota" />

      {viagem && situacao && manutencao ? (
        <>
          {viagem.onibus.emManutencao && (
            <Aviso tipo="alerta" titulo="O ônibus da sua viagem está em manutenção">
              {viagem.onibus.observacaoManutencao ?? "A viagem pode atrasar ou ser remanejada."}
            </Aviso>
          )}
          <Secao titulo="Sua viagem de hoje" />
          <Card semPadding>
            <ItemLista
              icone={situacao.icone}
              tomIcone={situacao.tom}
              titulo={situacao.rotulo}
              subtitulo={`${viagem.rota.nome} • saída ${viagem.horario}`}
            />
            <ItemLista
              icone="bus-outline"
              tomIcone="neutro"
              titulo={viagem.onibus.placa}
              subtitulo="Ônibus"
              direita={<Pilula texto={manutencao.rotulo} tom={manutencao.tom} icone={manutencao.icone} />}
            />
            {viagem.motorista && (
              <ItemLista icone="person-outline" tomIcone="neutro" titulo={viagem.motorista.usuario.nome} subtitulo="Motorista" ultimo />
            )}
          </Card>
        </>
      ) : (
        <Card>
          <EstadoVazio icone="bus-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem para a sua universidade hoje." />
        </Card>
      )}

      <Secao titulo={`Frota (${frota.length})`} />
      <Card semPadding>
        {frota.map((o, i) => {
          const st = statusManutencao(o.emManutencao);
          return (
            <ItemLista
              key={o.id}
              icone="bus"
              tomIcone={o.emManutencao ? "alerta" : "info"}
              titulo={o.placa}
              subtitulo={o.emManutencao ? o.observacaoManutencao ?? undefined : undefined}
              direita={<Pilula texto={st.rotulo} tom={st.tom} icone={st.icone} />}
              ultimo={i === frota.length - 1}
            />
          );
        })}
        {frota.length === 0 && <EstadoVazio icone="bus-outline" titulo="Nenhum ônibus cadastrado" />}
      </Card>

      <Texto variante="legenda" cor="textoFraco" alinhar="center" style={{ marginTop: 8 }}>
        A localização em tempo real do ônibus chegará em uma próxima versão.
      </Texto>
    </Tela>
  );
}
