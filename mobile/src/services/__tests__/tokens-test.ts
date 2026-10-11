// No preset jest-expo o Platform.OS é "ios": aqui se testa o caminho do celular (SecureStore).
// O estado dos mocks fica fora deles porque cada "abertura do app" recarrega os módulos.

const mockCofre = new Map<string, string>(); // SecureStore
const mockArmazem = new Map<string, string>(); // AsyncStorage
const mockLeiturasDoCofre = jest.fn();

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: async (k: string) => {
    mockLeiturasDoCofre(k);
    return mockCofre.get(k) ?? null;
  },
  setItemAsync: async (k: string, v: string) => void mockCofre.set(k, v),
  deleteItemAsync: async (k: string) => void mockCofre.delete(k),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockArmazem.get(k) ?? null,
    multiGet: async (ks: string[]) => ks.map((k) => [k, mockArmazem.get(k) ?? null]),
    multiSet: async (pares: [string, string][]) => pares.forEach(([k, v]) => mockArmazem.set(k, v)),
    multiRemove: async (ks: string[]) => ks.forEach((k) => mockArmazem.delete(k)),
  },
}));

type ModuloTokens = typeof import("../tokens");

/** Cada chamada simula o app recém-aberto (sem a cópia em memória). */
function abrirApp(): ModuloTokens {
  let modulo!: ModuloTokens;
  jest.isolateModules(() => {
    // isolateModules só vale para require síncrono
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require("../tokens");
  });
  return modulo;
}

beforeEach(() => {
  mockCofre.clear();
  mockArmazem.clear();
  mockLeiturasDoCofre.mockClear();
});

describe("tokens da sessão no celular", () => {
  it("salva no SecureStore, não no AsyncStorage", async () => {
    await abrirApp().salvarTokens({ accessToken: "acesso-1", refreshToken: "renovacao-1" });
    expect(mockCofre.get("busOn.refreshToken")).toBe("renovacao-1");
    expect(mockArmazem.size).toBe(0);
    expect(await abrirApp().lerToken("accessToken")).toBe("acesso-1");
  });

  it("migra os tokens de versões antigas (AsyncStorage) sem pedir login", async () => {
    mockArmazem.set("@busOn:accessToken", "acesso-antigo");
    mockArmazem.set("@busOn:refreshToken", "renovacao-antiga");
    expect(await abrirApp().lerToken("refreshToken")).toBe("renovacao-antiga");
    expect(mockCofre.get("busOn.accessToken")).toBe("acesso-antigo");
    expect(mockArmazem.has("@busOn:accessToken")).toBe(false);
  });

  it("guarda em memória: o interceptor não vai ao cofre a cada requisição", async () => {
    await abrirApp().salvarTokens({ accessToken: "a", refreshToken: "r" });
    const tokens = abrirApp();
    await tokens.lerToken("accessToken");
    await tokens.lerToken("accessToken");
    await tokens.lerToken("refreshToken");
    expect(mockLeiturasDoCofre).toHaveBeenCalledTimes(2); // uma leitura de cada chave
  });

  it("leituras simultâneas na abertura compartilham a mesma carga", async () => {
    await abrirApp().salvarTokens({ accessToken: "a", refreshToken: "r" });
    const tokens = abrirApp();
    await Promise.all([tokens.lerToken("accessToken"), tokens.lerToken("accessToken"), tokens.lerToken("refreshToken")]);
    expect(mockLeiturasDoCofre).toHaveBeenCalledTimes(2);
  });

  it("um login durante a leitura inicial não é sobrescrito pelos tokens antigos", async () => {
    await abrirApp().salvarTokens({ accessToken: "velho", refreshToken: "velho-r" });
    const tokens = abrirApp();
    const leitura = tokens.lerToken("accessToken");
    await tokens.salvarTokens({ accessToken: "novo", refreshToken: "novo-r" });
    await leitura;
    expect(await tokens.lerToken("accessToken")).toBe("novo");
  });

  it("apagarTokens limpa cofre, memória e restos antigos", async () => {
    const tokens = abrirApp();
    await tokens.salvarTokens({ accessToken: "a", refreshToken: "r" });
    mockArmazem.set("@busOn:refreshToken", "resto");
    await tokens.apagarTokens();
    expect(await tokens.lerToken("refreshToken")).toBeNull();
    expect(mockCofre.size).toBe(0);
    expect(mockArmazem.size).toBe(0);
  });

  it("sem nada salvo, não há sessão", async () => {
    expect(await abrirApp().lerToken("refreshToken")).toBeNull();
  });
});
