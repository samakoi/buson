import React, { useRef, useState } from "react";
import { StyleSheet, Vibration, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { Viagem } from "../../types";
import { useCarregamento } from "../../hooks/useCarregamento";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { elevacao } from "../../theme/tokens";
import { Botao, Cabecalho, Card, Carregando, EstadoVazio, Tela, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";
import type { AbasMotorista } from "../../navigation/MotoristaTabs";

interface Resultado {
  ok: boolean;
  titulo: string;
  detalhe?: string;
}

// O mesmo QR na frente da câmera dispara várias leituras por segundo: ignora repetições
const INTERVALO_MESMO_CODIGO_MS = 4000;

export default function EmbarqueScreen() {
  const focada = useIsFocused();
  const navegacao = useNavigation<BottomTabNavigationProp<AbasMotorista>>();
  const insets = useSafeAreaInsets();
  const { cores } = useTema();
  const s = useEstilos();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const processando = useRef(false);
  const ultimaLeitura = useRef<{ codigo: string; quando: number } | null>(null);

  const { carregando, atualizando, atualizar, recarregar } = useCarregamento(async () => {
    const { data } = await api.get<Viagem | null>("/viagens/atual");
    setViagem(data);
  });

  async function aoLerCodigo({ data: codigo }: BarcodeScanningResult) {
    if (!viagem || processando.current) return;
    const agora = Date.now();
    const ultima = ultimaLeitura.current;
    if (ultima && ultima.codigo === codigo && agora - ultima.quando < INTERVALO_MESMO_CODIGO_MS) return;
    ultimaLeitura.current = { codigo, quando: agora };

    processando.current = true;
    try {
      const { data } = await api.post<{ aluno: { nome: string; universidade: string } }>(`/viagens/${viagem.id}/embarque`, { qrCode: codigo });
      Vibration.vibrate(80);
      setResultado({ ok: true, titulo: `${data.aluno.nome} embarcou`, detalhe: data.aluno.universidade });
      recarregar();
    } catch (err) {
      Vibration.vibrate([0, 80, 80, 80]);
      setResultado({ ok: false, titulo: mensagemDeErro(err, "Não foi possível confirmar o embarque.") });
    } finally {
      processando.current = false;
    }
  }

  if (carregando || !permissao) return <Carregando />;

  if (!viagem || viagem.status !== "EM_ANDAMENTO") {
    const aguardando = viagem?.status === "AGUARDANDO";
    return (
      <Tela atualizando={atualizando} onAtualizar={atualizar}>
        <Cabecalho titulo="Embarque" subtitulo="Leitura do QR Code dos alunos" />
        <Card>
          <EstadoVazio
            icone={aguardando ? "play-circle-outline" : "scan-circle-outline"}
            titulo={!viagem ? "Nenhuma viagem hoje" : aguardando ? "Inicie a viagem primeiro" : "Viagem encerrada"}
            texto={
              !viagem
                ? "Não há viagem atribuída a você hoje."
                : aguardando
                  ? "Os embarques só podem ser confirmados com a viagem em andamento."
                  : "Esta viagem já foi encerrada."
            }
            acao={aguardando ? { titulo: "Ir para o Painel", icone: "speedometer-outline", onPress: () => navegacao.navigate("Painel") } : undefined}
          />
        </Card>
      </Tela>
    );
  }

  if (!permissao.granted) {
    return (
      <Tela>
        <Cabecalho titulo="Embarque" subtitulo="Leitura do QR Code dos alunos" />
        <Card>
          <EstadoVazio
            icone="camera-outline"
            titulo="Permita o uso da câmera"
            texto={
              "A câmera é usada para ler o QR Code de embarque dos alunos." +
              (!permissao.canAskAgain ? " A permissão foi negada: libere-a nas configurações do aparelho." : "")
            }
            acao={permissao.canAskAgain ? { titulo: "Permitir câmera", icone: "camera", onPress: pedirPermissao } : undefined}
          />
        </Card>
        <Botao titulo="Confirmar manualmente" icone="people-outline" variante="fantasma" onPress={() => navegacao.navigate("Passageiros")} />
      </Tela>
    );
  }

  const { confirmados, embarcados } = viagem.resumo;

  return (
    <View style={s.camera}>
      {/* A câmera só fica ligada com a aba visível (economiza bateria e libera a câmera) */}
      {focada && (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={aoLerCodigo} />
      )}

      <View style={[s.contador, { top: insets.top + 16 }]}>
        <Texto variante="numero" cor="sobreDestaque">
          {embarcados}/{confirmados}
        </Texto>
        <Texto variante="pequenoForte" cor="sobreDestaqueSuave">
          embarcados
        </Texto>
      </View>

      <View style={[s.moldura, { pointerEvents: "none" }]} />
      <View style={s.instrucao}>
        <Texto variante="pequenoForte" cor="sobreDestaque">
          Aponte para o QR Code do aluno
        </Texto>
      </View>

      {resultado && (
        <View style={s.resultado}>
          <View style={[s.faixa, { backgroundColor: resultado.ok ? cores.sucesso : cores.perigo }]} />
          <Ionicons name={resultado.ok ? "checkmark-circle" : "close-circle"} size={32} color={resultado.ok ? cores.sucesso : cores.perigo} />
          <View style={{ flex: 1 }}>
            <Texto variante="subtitulo">{resultado.titulo}</Texto>
            {resultado.detalhe && (
              <Texto variante="pequeno" cor="textoSuave">
                {resultado.detalhe}
              </Texto>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  camera: { flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" },
  contador: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "baseline",
    gap: t.espaco.sm,
    backgroundColor: t.cores.destaque,
    opacity: 0.94,
    borderRadius: t.raio.pill,
    paddingHorizontal: t.espaco.xl,
    paddingVertical: t.espaco.sm,
  },
  moldura: { width: 240, height: 240, borderRadius: t.raio.xl, borderWidth: 3, borderColor: "rgba(255,255,255,0.92)" },
  instrucao: { marginTop: t.espaco.lg, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: t.raio.pill, paddingHorizontal: t.espaco.md, paddingVertical: t.espaco.xs + 2 },
  resultado: {
    position: "absolute",
    left: t.espaco.lg,
    right: t.espaco.lg,
    bottom: t.espaco.xl,
    maxWidth: 608,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: t.espaco.md,
    backgroundColor: t.cores.superficie,
    borderRadius: t.raio.lg,
    padding: t.espaco.lg,
    paddingLeft: t.espaco.xl,
    overflow: "hidden",
    ...elevacao(t.cores, t.escuro, 2),
  },
  faixa: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
}));
