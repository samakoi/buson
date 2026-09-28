import React, { useRef, useState } from "react";
import { StyleSheet, Vibration, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { criarEstilos, useTema } from "../../theme/TemaProvider";
import { elevacao } from "../../theme/tokens";
import { Aviso, Botao, Cabecalho, Card, Carregando, EstadoVazio, ItemLista, Tela, Texto } from "../../components/ui";
import { mensagemDeErro } from "../../utils/feedback";
import { Viagem } from "../../types";
import { useViagemAtual } from "../viagens/api";
import { lerConteudoQr, useEscanearQr } from "./api";

function hora(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

/** Tela de sucesso: embarque já registrado nesta viagem (novo embarque bloqueado). */
function EmbarqueConfirmado({ viagem, horaEmbarque }: { viagem: Viagem; horaEmbarque?: string | null }) {
  const { cores } = useTema();
  const s = useEstilos();
  return (
    <Tela>
      <Cabecalho titulo="Embarcar" />
      <Card style={s.sucesso}>
        <View style={[s.selo, { backgroundColor: cores.sucessoFundo }]}>
          <Ionicons name="checkmark" size={48} color={cores.sucesso} />
        </View>
        <Texto variante="titulo" alinhar="center">
          Embarque confirmado
        </Texto>
        <Texto variante="corpo" cor="textoSuave" alinhar="center">
          Boa viagem!
        </Texto>
      </Card>
      <Card semPadding>
        <ItemLista icone="bus-outline" tomIcone="neutro" titulo={viagem.onibus.placa} subtitulo="Ônibus" />
        <ItemLista icone="git-commit-outline" tomIcone="neutro" titulo={viagem.rota.nome} subtitulo="Rota" />
        <ItemLista icone="time-outline" tomIcone="neutro" titulo={hora(horaEmbarque)} subtitulo="Horário do embarque" ultimo />
      </Card>
    </Tela>
  );
}

/** Aluno escaneia o QR exibido pelo motorista para registrar o embarque. */
export default function EmbarcarScreen() {
  const focada = useIsFocused();
  const insets = useSafeAreaInsets();
  const { cores } = useTema();
  const s = useEstilos();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const { data: viagem, isLoading, refetch, isRefetching } = useViagemAtual({ atualizarACada: 15_000 });
  const escanear = useEscanearQr();
  const [erro, setErro] = useState<string | null>(null);
  const processando = useRef(false);
  const ultimoLido = useRef<{ texto: string; quando: number } | null>(null);

  async function aoLer({ data: texto }: BarcodeScanningResult) {
    if (!viagem || processando.current) return;
    // A câmera lê o mesmo QR várias vezes por segundo: ignora repetições por 3 s
    const agora = Date.now();
    if (ultimoLido.current && ultimoLido.current.texto === texto && agora - ultimoLido.current.quando < 3000) return;
    ultimoLido.current = { texto, quando: agora };

    const lido = lerConteudoQr(texto);
    if (!lido) {
      setErro("Este não é um QR de embarque do Bus On. Escaneie o QR que está na tela do motorista.");
      return;
    }
    if (lido.viagemId !== viagem.id) {
      setErro("Este QR é de outra viagem. Confira se você está no ônibus certo.");
      return;
    }
    processando.current = true;
    setErro(null);
    try {
      await escanear.mutateAsync({ viagemId: viagem.id, token: lido.token });
      Vibration.vibrate(80);
    } catch (err) {
      Vibration.vibrate([0, 80, 80, 80]);
      setErro(mensagemDeErro(err, "Não foi possível registrar o embarque."));
    } finally {
      processando.current = false;
    }
  }

  if (isLoading || !permissao) return <Carregando />;

  const meu = viagem?.meuCheckin;
  const resultado = escanear.data;
  if (viagem && (meu?.embarcado || resultado)) {
    return <EmbarqueConfirmado viagem={viagem} horaEmbarque={resultado?.dataHora ?? meu?.embarcadoEm} />;
  }

  // Situações em que ainda não dá para embarcar
  let bloqueio: { icone: React.ComponentProps<typeof EstadoVazio>["icone"]; titulo: string; texto: string } | null = null;
  if (!viagem) bloqueio = { icone: "calendar-outline", titulo: "Nenhuma viagem hoje", texto: "Não há viagem para a sua instituição hoje." };
  else if (viagem.status === "ENCERRADA") bloqueio = { icone: "flag-outline", titulo: "Viagem encerrada", texto: "Esta viagem já terminou." };
  else if (!meu || meu.status !== "CONFIRMADO")
    bloqueio = {
      icone: "ticket-outline",
      titulo: "Sem vaga confirmada",
      texto: meu?.status === "ESPERA" ? "Você está na lista de espera desta viagem." : "Confirme sua presença na tela Início para poder embarcar.",
    };
  else if (viagem.status === "AGUARDANDO")
    bloqueio = {
      icone: "time-outline",
      titulo: "A viagem ainda não começou",
      texto: `Quando o motorista iniciar a viagem (saída ${viagem.horario}), volte aqui e escaneie o QR que aparece no celular dele.`,
    };

  if (bloqueio) {
    return (
      <Tela atualizando={isRefetching} onAtualizar={refetch}>
        <Cabecalho titulo="Embarcar" subtitulo="Escaneie o QR Code do motorista" />
        <Card>
          <EstadoVazio icone={bloqueio.icone} titulo={bloqueio.titulo} texto={bloqueio.texto} />
        </Card>
      </Tela>
    );
  }

  if (!permissao.granted) {
    return (
      <Tela>
        <Cabecalho titulo="Embarcar" subtitulo="Escaneie o QR Code do motorista" />
        <Card>
          <EstadoVazio
            icone="camera-outline"
            titulo="Permita o uso da câmera"
            texto={
              "A câmera é usada só para ler o QR Code de embarque." +
              (!permissao.canAskAgain ? " A permissão foi negada: libere-a nas configurações do aparelho." : "")
            }
            acao={permissao.canAskAgain ? { titulo: "Permitir câmera", icone: "camera", onPress: pedirPermissao } : undefined}
          />
        </Card>
        <Aviso tipo="info" titulo="Sem câmera funcionando?">
          Peça ao motorista para confirmar seu embarque manualmente.
        </Aviso>
      </Tela>
    );
  }

  return (
    <View style={s.camera}>
      {/* Câmera ligada só com a aba visível (economiza bateria e libera a câmera) */}
      {focada && (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={aoLer} />
      )}

      <View style={[s.topo, { top: insets.top + 16 }]}>
        <Texto variante="pequenoForte" cor="sobreDestaque">
          {viagem!.onibus.placa} • saída {viagem!.horario}
        </Texto>
      </View>

      <View style={[s.moldura, { pointerEvents: "none" }]} />
      <View style={s.instrucao}>
        <Texto variante="pequenoForte" cor="sobreDestaque">
          {escanear.isPending ? "Confirmando embarque..." : "Aponte para o QR Code do motorista"}
        </Texto>
      </View>

      {erro && (
        <View style={s.resultado}>
          <View style={[s.faixa, { backgroundColor: cores.perigo }]} />
          <Ionicons name="close-circle" size={30} color={cores.perigo} />
          <View style={{ flex: 1, gap: 8 }}>
            <Texto variante="corpoForte">{erro}</Texto>
            <Botao titulo="Tentar de novo" variante="secundario" onPress={() => setErro(null)} style={{ minHeight: 40, alignSelf: "flex-start" }} />
          </View>
        </View>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((t) => ({
  sucesso: { alignItems: "center", gap: t.espaco.sm, paddingVertical: t.espaco.xxl },
  selo: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: t.espaco.sm },
  camera: { flex: 1, backgroundColor: "black", alignItems: "center", justifyContent: "center" },
  topo: {
    position: "absolute",
    alignSelf: "center",
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
    alignItems: "flex-start",
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
