import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { api } from "../../services/api";
import { Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, BarraProgresso, Botao, Cabecalho, Card, Carregando, EstadoVazio, Estatistica, GradeEstatisticas, Pilula, Tela, Texto } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";
import { statusViagem } from "../../utils/rotulos";
import type { AbasMotorista } from "../../navigation/MotoristaTabs";
import { useEncerrarViagem } from "../../features/viagens/api";

export default function PainelScreen() {
  const navegacao = useNavigation<BottomTabNavigationProp<AbasMotorista>>();
  const { cores } = useTema();
  const s = useEstilos();
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [processando, setProcessando] = useState(false);

  // Recarrega sozinho para acompanhar novos check-ins antes da saída
  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(
    async () => {
      const { data } = await api.get<Viagem | null>("/viagens/atual");
      setViagem(data);
    },
    { intervaloMs: 20_000 }
  );

  async function iniciar() {
    if (!viagem) return;
    setProcessando(true);
    try {
      await api.post(`/viagens/${viagem.id}/iniciar`);
      await recarregar();
    } catch (err) {
      avisar("Não foi possível iniciar", mensagemDeErro(err, "Tente novamente."));
    } finally {
      setProcessando(false);
    }
  }

  // Mesma confirmação e regra da tela do QR (evita duas versões do "encerrar")
  const { encerrar: confirmarEncerramento, encerrando } = useEncerrarViagem(() => recarregar());
  const encerrar = () => viagem && confirmarEncerramento(viagem);


  if (carregando) return <Carregando />;

  if (!viagem) {
    return (
      <Tela atualizando={atualizando} onAtualizar={atualizar}>
        <Cabecalho titulo="Painel" />
        <Card>
          <EstadoVazio icone="calendar-outline" titulo="Nenhuma viagem hoje" texto="Não há viagem atribuída a você hoje. Puxe para baixo para atualizar." />
        </Card>
      </Tela>
    );
  }

  const r = viagem.resumo;
  const status = statusViagem[viagem.status];
  const faltam = r.ocupados - r.embarcados;

  // Ação principal fixa no rodapé: fácil de alcançar com o polegar
  const rodape =
    viagem.status === "AGUARDANDO" ? (
      <Botao
        titulo="Iniciar viagem"
        icone="play-circle"
        tamanho="grande"
        onPress={iniciar}
        carregando={processando}
        desabilitado={viagem.onibus.emManutencao}
      />
    ) : viagem.status === "EM_ANDAMENTO" ? (
      <Botao titulo="Encerrar viagem" icone="stop-circle" tamanho="grande" variante="perigo" onPress={encerrar} carregando={encerrando} />
    ) : undefined;

  return (
    <Tela atualizando={atualizando} onAtualizar={atualizar} rodape={rodape}>
      <Cabecalho titulo="Painel" subtitulo={`${viagem.sentido === "VOLTA" ? "Volta" : "Ida"} • ${viagem.rota.nome}`} />

      {viagem.onibus.emManutencao && viagem.status === "AGUARDANDO" && (
        <Aviso tipo="alerta" titulo={`Ônibus ${viagem.onibus.placa} em manutenção`}>
          {`${viagem.onibus.observacaoManutencao ? viagem.onibus.observacaoManutencao + ". " : ""}A viagem só pode ser iniciada quando a administração liberar o ônibus.`}
        </Aviso>
      )}

      <Card>
        <View style={s.topo}>
          <View>
            <Texto variante="legenda" cor="textoSuave">
              Saída
            </Texto>
            <Texto variante="numeroGrande">{viagem.horario}</Texto>
          </View>
          <View style={s.direita}>
            <Pilula texto={status.rotulo} tom={status.tom} icone={status.icone} />
            <Texto variante="pequenoForte" cor="textoSuave">
              {viagem.onibus.placa}
            </Texto>
          </View>
        </View>

        <View style={s.progresso}>
          <View style={s.progressoTexto}>
            <Texto variante="pequenoForte">Embarques</Texto>
            <Texto variante="pequenoForte" cor="textoSuave">
              {r.embarcados} de {r.ocupados}
            </Texto>
          </View>
          <BarraProgresso valor={r.ocupados ? r.embarcados / r.ocupados : 0} cor={cores.sucesso} altura={10} />
        </View>
      </Card>

      <GradeEstatisticas>
        <Estatistica rotulo="Passageiros" valor={`${r.ocupados}/${viagem.vagas}`} tom="info" icone="people-outline" />
        <Estatistica rotulo="Embarcados" valor={r.embarcados} tom="sucesso" icone="checkmark-done-outline" />
        <Estatistica rotulo="Faltam embarcar" valor={faltam} tom={faltam > 0 ? "alerta" : "neutro"} icone="hourglass-outline" />
        <Estatistica rotulo="Lista de espera" valor={r.espera} icone="time-outline" />
      </GradeEstatisticas>

      {viagem.status === "EM_ANDAMENTO" && (
        <Botao titulo="Mostrar QR de embarque" icone="qr-code" variante="secundario" tamanho="grande" onPress={() => navegacao.navigate("Embarque")} />
      )}
      {viagem.status === "AGUARDANDO" && !viagem.onibus.emManutencao && (
        <Texto variante="pequeno" cor="textoSuave" alinhar="center">
          Ao iniciar, o check-in dos alunos fecha e os embarques podem ser confirmados.
        </Texto>
      )}
      {viagem.status === "ENCERRADA" && (
        <Aviso tipo="sucesso" titulo="Viagem encerrada">
          {faltam > 0 ? `${faltam} aluno(s) foram registrados como falta.` : "Todos os passageiros embarcaram. Bom descanso!"}
        </Aviso>
      )}
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  direita: { alignItems: "flex-end", gap: t.espaco.sm },
  progresso: { marginTop: t.espaco.lg, gap: t.espaco.sm },
  progressoTexto: { flexDirection: "row", justifyContent: "space-between" },
}));
