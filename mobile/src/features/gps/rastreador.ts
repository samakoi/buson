import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { create } from "zustand";
import { api } from "../../services/api";

/**
 * GPS do motorista durante a viagem (Fase 6).
 *  - No APK: segundo plano (continua com a tela apagada), com a notificação fixa do Android.
 *  - No Expo Go, navegador ou sem a permissão "o tempo todo": só com o app aberto.
 *  - Sem internet, as leituras ficam guardadas (até 200) e vão no próximo envio.
 *  - A API recusa posições de viagem encerrada: aí o rastreamento para sozinho.
 */

export const TAREFA_GPS = "bus-on-gps";
const CHAVE_VIAGEM = "@busOn:gpsViagem";
const CHAVE_FILA = "@busOn:gpsFila";
const OPCOES = { accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 50 };

export type ModoGps = "desligado" | "segundo-plano" | "primeiro-plano" | "sem-permissao";

interface EstadoGps {
  viagemId: string | null;
  modo: ModoGps;
  ultimoEnvioEm: number | null;
  pendentes: number;
}

/** Estado para o Painel mostrar "Compartilhando localização…". */
export const useEstadoGps = create<EstadoGps>(() => ({ viagemId: null, modo: "desligado", ultimoEnvioEm: null, pendentes: 0 }));

interface Leitura {
  latitude: number;
  longitude: number;
  velocidade: number | null;
  direcao: number | null;
  precisao: number | null;
  registradoEm: string;
}

const paraLeitura = (l: Location.LocationObject): Leitura => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  velocidade: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
  direcao: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
  precisao: l.coords.accuracy ?? null,
  registradoEm: new Date(l.timestamp).toISOString(),
});

export const suportaSegundoPlano = () =>
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let enviando: Promise<void> | null = null;

/** Junta as leituras novas às guardadas e tenta enviar tudo. */
export async function enviarLeituras(locais: Location.LocationObject[]) {
  const anterior = enviando;
  enviando = (async () => {
    await anterior?.catch(() => undefined);
    const viagemId = await AsyncStorage.getItem(CHAVE_VIAGEM);
    if (!viagemId) return;
    const guardadas: Leitura[] = JSON.parse((await AsyncStorage.getItem(CHAVE_FILA)) ?? "[]");
    const fila = [...guardadas, ...locais.map(paraLeitura)].slice(-200);
    if (fila.length === 0) return;
    try {
      await api.post(`/viagens/${viagemId}/localizacao`, { pontos: fila });
      await AsyncStorage.setItem(CHAVE_FILA, "[]");
      useEstadoGps.setState({ ultimoEnvioEm: Date.now(), pendentes: 0 });
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 409 || status === 403 || status === 404) {
        await pararRastreamento(); // viagem encerrada/de outro motorista: não adianta insistir
        return;
      }
      await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila)); // sem internet: tenta no próximo
      useEstadoGps.setState({ pendentes: fila.length });
    }
  })();
  return enviando;
}

// A tarefa de segundo plano precisa ser registrada ao carregar o app (fora dos componentes)
if (Platform.OS !== "web") {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_GPS, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await enviarLeituras(data.locations);
  });
}

let observador: Location.LocationSubscription | null = null;

/** Liga o GPS para a viagem. Pede as permissões e escolhe o modo possível. */
export async function iniciarRastreamento(viagemId: string): Promise<ModoGps> {
  await AsyncStorage.setItem(CHAVE_VIAGEM, viagemId);
  useEstadoGps.setState({ viagemId });

  const primeiro = await Location.requestForegroundPermissionsAsync();
  if (!primeiro.granted) {
    useEstadoGps.setState({ modo: "sem-permissao" });
    return "sem-permissao";
  }

  if (suportaSegundoPlano()) {
    try {
      // No Android 11+ isto abre as configurações para escolher "Permitir o tempo todo"
      const fundo = await Location.requestBackgroundPermissionsAsync();
      if (fundo.granted) {
        if (!(await Location.hasStartedLocationUpdatesAsync(TAREFA_GPS))) {
          await Location.startLocationUpdatesAsync(TAREFA_GPS, {
            ...OPCOES,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.AutomotiveNavigation,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "Bus On",
              notificationBody: "Compartilhando a localização do ônibus com os alunos",
              notificationColor: "#1E5AA8",
              killServiceOnDestroy: false,
            },
          });
        }
        useEstadoGps.setState({ modo: "segundo-plano" });
        return "segundo-plano";
      }
    } catch (err) {
      console.warn("GPS em segundo plano indisponível; usando só com o app aberto", err);
    }
  }

  // Alternativa: envia enquanto o app estiver aberto
  observador?.remove();
  observador = await Location.watchPositionAsync(OPCOES, (l) => {
    void enviarLeituras([l]);
  });
  useEstadoGps.setState({ modo: "primeiro-plano" });
  return "primeiro-plano";
}

export async function pararRastreamento() {
  observador?.remove();
  observador = null;
  if (suportaSegundoPlano()) {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(TAREFA_GPS)) await Location.stopLocationUpdatesAsync(TAREFA_GPS);
    } catch (err) {
      console.warn("Falha ao parar o GPS", err);
    }
  }
  await AsyncStorage.multiRemove([CHAVE_VIAGEM, CHAVE_FILA]);
  useEstadoGps.setState({ viagemId: null, modo: "desligado", pendentes: 0 });
}

/** Viagem que estava sendo rastreada quando o app abriu (se houver). */
export const viagemRastreada = () => AsyncStorage.getItem(CHAVE_VIAGEM);
