import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../services/api";
import { obterDeviceId } from "../../services/dispositivo";

/**
 * Push no celular. Só funciona num build do app (APK/development build) com o projeto
 * EAS configurado: no navegador, no emulador e no Expo Go do Android (SDK 53+) o push
 * fica desligado e os avisos continuam na aba Avisos.
 */

const CANAL = "avisos"; // o mesmo canal que a API usa ao enviar
const CHAVE_DISPENSADO = "@busOn:pushDispensado";

// Aviso que chega com o app aberto também aparece (banner + central de notificações)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const projectId = (): string | undefined => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export type DisponibilidadePush = "disponivel" | "navegador" | "emulador" | "expo-go" | "sem-projeto";

export function disponibilidadePush(): DisponibilidadePush {
  if (Platform.OS === "web") return "navegador";
  if (!Device.isDevice) return "emulador";
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return "expo-go";
  if (!projectId()) return "sem-projeto";
  return "disponivel";
}

export const explicacaoIndisponivel: Record<Exclude<DisponibilidadePush, "disponivel">, string> = {
  navegador: "No navegador os avisos ficam só na aba Avisos.",
  emulador: "No emulador não há push; os avisos ficam na aba Avisos.",
  "expo-go": "No Expo Go do Android não há push; ele funciona no app instalado (APK).",
  "sem-projeto": "O push ainda não foi configurado neste app (projeto EAS).",
};

export async function permissaoPush() {
  if (disponibilidadePush() !== "disponivel") return "indisponivel" as const;
  const { status } = await Notifications.getPermissionsAsync();
  return status; // "granted" | "denied" | "undetermined"
}

/** Pede a permissão (se preciso) e registra o aparelho na API. Devolve se ficou ativo. */
export async function ativarPush(): Promise<boolean> {
  if (disponibilidadePush() !== "disponivel") return false;
  if (Platform.OS === "android") {
    // No Android 8+ o canal precisa existir antes de pedir a permissão
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: "Avisos do Bus On",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#1E5AA8",
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return false;
  await registrarAparelho();
  return true;
}

/** Com a permissão já dada, registra de novo (o token pode mudar e o login pode ser outro). */
export async function registrarSeJaPermitido() {
  if ((await permissaoPush()) === "granted") await registrarAparelho().catch((err) => console.warn("Push: falha ao registrar", err));
}

async function registrarAparelho() {
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await api.post("/notificacoes/dispositivos", {
    token,
    plataforma: Platform.OS === "ios" ? "IOS" : "ANDROID",
    deviceId: await obterDeviceId(),
  });
}

/** O usuário tocou em "Agora não" no convite para ativar o push. */
export async function convitePushDispensado() {
  try {
    return (await AsyncStorage.getItem(CHAVE_DISPENSADO)) === "1";
  } catch {
    return false;
  }
}

export async function dispensarConvitePush() {
  try {
    await AsyncStorage.setItem(CHAVE_DISPENSADO, "1");
  } catch {
    /* sem armazenamento: o convite volta na próxima vez */
  }
}
