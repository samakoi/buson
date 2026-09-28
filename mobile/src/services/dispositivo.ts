import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE = "@busOn:deviceId";
let emMemoria: string | null = null;

/**
 * Identificador deste aparelho (gerado uma vez e guardado). A API usa para
 * separar as sessões: "sair deste aparelho" encerra só a sessão dele.
 */
export async function obterDeviceId(): Promise<string> {
  if (emMemoria) return emMemoria;
  let id = await AsyncStorage.getItem(CHAVE);
  if (!id) {
    const aleatorio = () => Math.random().toString(36).slice(2, 10);
    id = `app-${Date.now().toString(36)}-${aleatorio()}${aleatorio()}`;
    await AsyncStorage.setItem(CHAVE, id);
  }
  emMemoria = id;
  return id;
}
