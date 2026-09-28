import React, { useState } from "react";
import { api } from "../../services/api";
import { Checkin, Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { Aviso, Botao, Cabecalho, Card, Carregando, EstadoVazio, ItemLista, Pilula, Secao, Tela, iniciaisDe } from "../../components/ui";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";

export default function PassageirosScreen() {
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [passageiros, setPassageiros] = useState<Checkin[]>([]);

  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(
    async () => {
      const { data: atual } = await api.get<Viagem | null>("/viagens/atual");
      setViagem(atual);
      if (atual) {
        const { data } = await api.get<Checkin[]>(`/viagens/${atual.id}/passageiros`);
        setPassageiros(data);
      } else {
        setPassageiros([]);
      }
    },
    { intervaloMs: 20_000 }
  );

  // Emergência: aluno sem celular, câmera com defeito etc. (fica auditado no servidor)
  async function confirmarManualmente(item: Checkin) {
    if (!viagem) return;
    const ok = await confirmar("Confirmar embarque manual", `${item.aluno.usuario.nome} não conseguiu escanear o QR? Confirmar o embarque manualmente (fica registrado)?`, {
      textoConfirmar: "Confirmar",
    });
    if (!ok) return;
    try {
      await api.post(`/viagens/${viagem.id}/embarque/manual`, { alunoId: item.alunoId });
      await recarregar();
    } catch (err) {
      avisar("Não foi possível confirmar", mensagemDeErro(err, "Tente novamente."));
    }
  }

  if (carregando) return <Carregando />;

  const confirmados = passageiros.filter((p) => p.status === "CONFIRMADO");
  const faltam = confirmados.filter((p) => !p.embarcado);
  const embarcaram = confirmados.filter((p) => p.embarcado);
  const espera = passageiros.filter((p) => p.status === "ESPERA");
  const podeEmbarcar = viagem?.status === "EM_ANDAMENTO";

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar}>
      <Cabecalho
        titulo="Passageiros"
        subtitulo={viagem ? `${embarcaram.length} de ${confirmados.length} embarcaram` : undefined}
      />

      {!viagem ? (
        <Card>
          <EstadoVazio icone="people-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem atribuída a você hoje." />
        </Card>
      ) : (
        <>
          {!podeEmbarcar && (
            <Aviso tipo="info" titulo={viagem.status === "AGUARDANDO" ? "Viagem ainda não iniciada" : "Viagem encerrada"}>
              {viagem.status === "AGUARDANDO" ? "Os embarques podem ser confirmados depois que você iniciar a viagem." : "Não é mais possível confirmar embarques."}
            </Aviso>
          )}

          {confirmados.length === 0 && (
            <Card>
              <EstadoVazio icone="people-outline" titulo="Ninguém confirmado ainda" texto="Os alunos aparecem aqui assim que fizerem check-in." />
            </Card>
          )}

          {faltam.length > 0 && (
            <>
              <Secao titulo={`Faltam embarcar (${faltam.length})`} />
              <Card semPadding>
                {faltam.map((p, i) => (
                  <ItemLista
                    key={p.id}
                    iniciais={iniciaisDe(p.aluno.usuario.nome)}
                    titulo={p.aluno.usuario.nome}
                    subtitulo={p.aluno.universidade.nome}
                    ultimo={i === faltam.length - 1}
                    direita={
                      podeEmbarcar ? (
                        <Botao titulo="Confirmar" variante="secundario" onPress={() => confirmarManualmente(p)} style={{ minHeight: 44, paddingHorizontal: 14 }} />
                      ) : undefined
                    }
                  />
                ))}
              </Card>
            </>
          )}

          {embarcaram.length > 0 && (
            <>
              <Secao titulo={`Embarcaram (${embarcaram.length})`} />
              <Card semPadding>
                {embarcaram.map((p, i) => (
                  <ItemLista
                    key={p.id}
                    iniciais={iniciaisDe(p.aluno.usuario.nome)}
                    tomIcone="sucesso"
                    titulo={p.aluno.usuario.nome}
                    subtitulo={p.aluno.universidade.nome}
                    ultimo={i === embarcaram.length - 1}
                    direita={<Pilula texto="Embarcou" tom="sucesso" icone="checkmark" />}
                  />
                ))}
              </Card>
            </>
          )}

          {espera.length > 0 && (
            <>
              <Secao titulo={`Lista de espera (${espera.length})`} />
              <Card semPadding>
                {espera.map((p, i) => (
                  <ItemLista
                    key={p.id}
                    iniciais={`${i + 1}º`}
                    tomIcone="neutro"
                    titulo={p.aluno.usuario.nome}
                    subtitulo={p.aluno.universidade.nome}
                    ultimo={i === espera.length - 1}
                    apagado
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Tela>
  );
}
