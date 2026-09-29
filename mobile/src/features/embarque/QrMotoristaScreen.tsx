import React, { useEffect, useState } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useKeepAwake } from "expo-keep-awake";
import QRCode from "react-native-qrcode-svg";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { Aviso, BarraProgresso, Botao, Cabecalho, Card, Carregando, EstadoVazio, Pilula, Tela, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";
import { useEncerrarViagem, useViagemAtual } from "../viagens/api";
import { useGerarQr, useQrDaViagem } from "./api";
import type { AbasMotorista } from "../../navigation/MotoristaTabs";

/** Mantém a tela acesa só enquanto o QR estiver sendo exibido. */
function TelaAcesa() {
  useKeepAwake();
  return null;
}

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Motorista exibe o QR temporário da viagem; os alunos escaneiam no app deles.
 * O contador atualiza a cada 5 s enquanto a tela está aberta.
 */
export default function QrMotoristaScreen() {
  const navegacao = useNavigation<BottomTabNavigationProp<AbasMotorista>>();
  const { cores } = useTema();
  const s = useEstilos();
  const { width } = useWindowDimensions();
  const { data: viagem, isLoading, refetch, isRefetching } = useViagemAtual({ atualizarACada: 5_000 });
  const qr = useQrDaViagem((st) => (viagem ? st.porViagem[viagem.id] : undefined));
  const gerar = useGerarQr();
  const { encerrar, encerrando } = useEncerrarViagem();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const emAndamento = viagem?.status === "EM_ANDAMENTO";
  const expirou = !!qr && new Date(qr.expiraEm).getTime() <= agora;

  // Gera o QR ao abrir a viagem em andamento e renova sozinho quando vence
  useEffect(() => {
    if (viagem && emAndamento && (!qr || expirou) && !gerar.isPending && !gerar.isError) gerar.mutate(viagem.id);
  }, [viagem, emAndamento, qr, expirou, gerar]);

  if (isLoading) return <Carregando />;

  if (!viagem || !emAndamento) {
    const aguardando = viagem?.status === "AGUARDANDO";
    return (
      <Tela atualizando={isRefetching} onAtualizar={refetch}>
        <Cabecalho titulo="Embarque" subtitulo="QR Code para os alunos escanearem" />
        <Card>
          <EstadoVazio
            icone={aguardando ? "play-circle-outline" : "qr-code-outline"}
            titulo={!viagem ? "Nenhuma viagem hoje" : aguardando ? "Inicie a viagem primeiro" : "Viagem encerrada"}
            texto={
              !viagem
                ? "Não há viagem atribuída a você hoje."
                : aguardando
                  ? "O QR de embarque aparece aqui assim que você iniciar a viagem."
                  : "O QR desta viagem não vale mais."
            }
            acao={aguardando ? { titulo: "Ir para o Painel", icone: "speedometer-outline", onPress: () => navegacao.navigate("Painel") } : undefined}
          />
        </Card>
      </Tela>
    );
  }

  const { ocupados: confirmados, embarcados } = viagem.resumo;
  const aguardando = Math.max(0, confirmados - embarcados);
  const tamanhoQr = Math.min(280, width - 96);

  return (
    <Tela
      atualizando={isRefetching}
      onAtualizar={refetch}
      rodape={<Botao titulo="Encerrar viagem" icone="stop-circle" variante="perigo" tamanho="grande" onPress={() => encerrar(viagem)} carregando={encerrando} />}
    >
      <TelaAcesa />
      <Cabecalho titulo="Embarque" subtitulo={`${viagem.onibus.placa} • ${viagem.rota.nome}`} />

      <Card style={s.cartaoQr}>
        <Pilula texto="Viagem em andamento" tom="sucesso" icone="navigate" style={{ alignSelf: "center" }} />
        <View style={[s.qrBox, { minHeight: tamanhoQr + 32 }]}>
          {qr && !expirou ? (
            <QRCode value={qr.conteudoQr} size={tamanhoQr} color={cores.qrCor} backgroundColor={cores.qrFundo} />
          ) : (
            <ActivityIndicator color={cores.qrCor} size="large" />
          )}
        </View>
        <Texto variante="subtitulo" alinhar="center">
          Escaneie aqui para embarcar
        </Texto>
        {qr && (
          <Texto variante="pequeno" cor="textoSuave" alinhar="center">
            QR válido até {horaCurta(qr.expiraEm)} • renova sozinho
          </Texto>
        )}
      </Card>

      {gerar.isError && (
        <Aviso tipo="erro" titulo="Não foi possível gerar o QR">
          {mensagemDeErro(gerar.error, "Verifique a conexão e toque em Atualizar QR.")}
        </Aviso>
      )}

      <Card>
        <View style={s.contador}>
          <Texto variante="numeroGrande" cor="sucesso">
            {embarcados}
            <Texto variante="numero" cor="textoSuave">
              {" "}
              / {confirmados}
            </Texto>
          </Texto>
          <Texto variante="corpoForte" cor="textoSuave">
            embarcados
          </Texto>
        </View>
        <BarraProgresso valor={confirmados ? embarcados / confirmados : 0} cor={cores.sucesso} altura={10} />
        <Texto variante="pequenoForte" cor={aguardando > 0 ? "alerta" : "sucesso"} style={{ marginTop: 8 }}>
          {aguardando > 0 ? `${aguardando} aguardando embarque` : "Todos os passageiros embarcaram"}
        </Texto>
      </Card>

      <Botao
        titulo="Atualizar QR"
        icone="refresh"
        variante="secundario"
        onPress={() => gerar.mutate(viagem.id)}
        carregando={gerar.isPending}
      />
      <Texto variante="legenda" cor="textoFraco" alinhar="center" style={{ marginTop: 8 }}>
        Atualizar gera um QR novo e invalida o anterior na hora (use se alguém fotografou o QR).
      </Texto>
    </Tela>
  );
}

const useEstilos = criarEstilos((t) => ({
  cartaoQr: { alignItems: "stretch", gap: t.espaco.md, paddingVertical: t.espaco.xl },
  qrBox: {
    alignSelf: "center",
    backgroundColor: t.cores.qrFundo,
    padding: t.espaco.lg,
    borderRadius: t.raio.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  contador: { flexDirection: "row", alignItems: "baseline", gap: t.espaco.sm, marginBottom: t.espaco.sm },
}));
