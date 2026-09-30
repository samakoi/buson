import "dotenv/config";
import path from "node:path";
import { z } from "zod";

/**
 * Variáveis de ambiente validadas na inicialização. Se algo estiver faltando
 * ou inválido, a API não sobe e mostra exatamente o que corrigir.
 */
const esquema = z
  .object({
    NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter ao menos 16 caracteres"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    /** Validade do refresh token (sessão do dispositivo), em dias */
    REFRESH_TOKEN_DIAS: z.coerce.number().int().positive().default(30),
    /** Origens web permitidas (separadas por vírgula). Vazio = só apps nativos (sem Origin). "*" libera tudo (apenas desenvolvimento). */
    CORS_ORIGINS: z.string().default(""),
    /** Quantos proxies confiar para descobrir o IP real (Cloudflare Tunnel = 1) */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_CADASTRO_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(60),
    UPLOADS_DIR: z.string().optional(),
    /** Validade do QR de embarque exibido pelo motorista, em minutos */
    BOARDING_QR_MINUTOS: z.coerce.number().int().min(1).max(24 * 60).default(60),
    // Quantos dias à frente a programação semanal gera viagens (0 = desliga o agendador)
    DIAS_GERACAO_VIAGENS: z.coerce.number().int().min(0).max(31).default(7),
    // Push: "expo" envia pelo Expo Push; "teste" usa um carteiro falso (testes); "desligado" não envia
    PUSH_MODO: z.enum(["expo", "teste", "desligado"]).default("expo"),
    // Opcional: só se "Enhanced security for push notifications" estiver ligado no projeto Expo
    EXPO_ACCESS_TOKEN: z.string().optional(),
    PUSH_INTERVALO_MS: z.coerce.number().int().min(200).default(5000),
    RECIBOS_INTERVALO_MS: z.coerce.number().int().min(500).default(15 * 60 * 1000),
    // O Expo recomenda conferir os recibos ~15 min depois do envio
    RECIBOS_ESPERA_MS: z.coerce.number().int().min(0).default(15 * 60 * 1000),
    // Lembretes: X minutos antes da saída (0 desliga) e na véspera, no horário HH:MM (vazio desliga)
    LEMBRETE_SAIDA_MINUTOS: z.coerce.number().int().min(0).max(24 * 60).default(60),
    LEMBRETE_VESPERA_HORARIO: z
      .string()
      .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "use HH:MM ou deixe vazio")
      .default("20:00"),
    LEMBRETES_INTERVALO_MS: z.coerce.number().int().min(500).default(60 * 1000),
    // GPS: por quantos dias guardar as posições dos ônibus (LGPD)
    GPS_RETENCAO_DIAS: z.coerce.number().int().min(1).max(3650).default(90),
    // Monitoramento de erros (opcional): chave pública do projeto no Sentry
    SENTRY_DSN: z.string().url().or(z.literal("")).optional(),
    // App Android: versionCode mínimo aceito (0 = qualquer) e link para baixar o APK atual
    APP_VERSAO_MINIMA_ANDROID: z.coerce.number().int().min(0).default(0),
    APP_LINK_ANDROID: z.string().url().or(z.literal("")).default(""),
  })
  .superRefine((v, ctx) => {
    // Staging segue as mesmas regras da produção (é o ensaio dela)
    if (v.NODE_ENV === "production" || v.NODE_ENV === "staging") {
      if (v.JWT_SECRET.length < 32 || /troque|exemplo|secret/i.test(v.JWT_SECRET)) {
        ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "em produção/staging use um segredo aleatório com 32+ caracteres" });
      }
      if (v.CORS_ORIGINS.trim() === "*") {
        ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "em produção/staging liste as origens permitidas (não use *)" });
      }
      if (v.PUSH_MODO === "teste") {
        ctx.addIssue({ code: "custom", path: ["PUSH_MODO"], message: "o modo teste é só para os testes automáticos (use expo ou desligado)" });
      }
    }
  });

const lido = esquema.safeParse(process.env);
if (!lido.success) {
  const problemas = lido.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuração inválida no .env (veja .env.example):\n${problemas}`);
}
const v = lido.data;

export const env = {
  ambiente: v.NODE_ENV,
  producao: v.NODE_ENV === "production",
  port: v.PORT,
  databaseUrl: v.DATABASE_URL,
  jwtSecret: v.JWT_SECRET,
  jwtExpiresIn: v.JWT_EXPIRES_IN,
  refreshTokenDias: v.REFRESH_TOKEN_DIAS,
  corsOrigins: v.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  trustProxy: v.TRUST_PROXY,
  // Testes ficam em silêncio, a não ser que LOG_LEVEL seja informado (os E2E conferem os logs)
  logLevel: v.NODE_ENV === "test" && !process.env.LOG_LEVEL ? "silent" : v.LOG_LEVEL,
  rateLimit: { login: v.RATE_LIMIT_LOGIN_MAX, cadastro: v.RATE_LIMIT_CADASTRO_MAX, refresh: v.RATE_LIMIT_REFRESH_MAX },
  qrEmbarqueMinutos: v.BOARDING_QR_MINUTOS,
  diasGeracaoViagens: v.DIAS_GERACAO_VIAGENS,
  push: {
    modo: v.PUSH_MODO,
    accessToken: v.EXPO_ACCESS_TOKEN,
    intervaloMs: v.PUSH_INTERVALO_MS,
    recibosIntervaloMs: v.RECIBOS_INTERVALO_MS,
    recibosEsperaMs: v.RECIBOS_ESPERA_MS,
  },
  gpsRetencaoDias: v.GPS_RETENCAO_DIAS,
  appAndroid: { versaoMinima: v.APP_VERSAO_MINIMA_ANDROID, link: v.APP_LINK_ANDROID || null },
  lembretes: {
    saidaMinutos: v.LEMBRETE_SAIDA_MINUTOS,
    vesperaHorario: v.LEMBRETE_VESPERA_HORARIO || null,
    intervaloMs: v.LEMBRETES_INTERVALO_MS,
  },
  uploadsDir: v.UPLOADS_DIR ? path.resolve(v.UPLOADS_DIR) : path.resolve(__dirname, "../../uploads"),
};
