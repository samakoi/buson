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
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production") {
      if (v.JWT_SECRET.length < 32 || /troque|exemplo|secret/i.test(v.JWT_SECRET)) {
        ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "em produção use um segredo aleatório com 32+ caracteres" });
      }
      if (v.CORS_ORIGINS.trim() === "*") {
        ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "em produção liste as origens permitidas (não use *)" });
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
  logLevel: v.NODE_ENV === "test" ? "silent" : v.LOG_LEVEL,
  rateLimit: { login: v.RATE_LIMIT_LOGIN_MAX, cadastro: v.RATE_LIMIT_CADASTRO_MAX, refresh: v.RATE_LIMIT_REFRESH_MAX },
  uploadsDir: v.UPLOADS_DIR ? path.resolve(v.UPLOADS_DIR) : path.resolve(__dirname, "../../uploads"),
};
