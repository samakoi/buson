import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Backup do Bus On: dump do banco (mysqldump) + pacote da pasta de documentos.
 *  - Guarda BACKUP_DIAS_LOCAL (14) dias na pasta BACKUP_DIR.
 *  - Se o Cloudflare R2 estiver configurado, envia uma cópia e guarda BACKUP_DIAS_NUVEM (30) dias lá.
 * Roda no container "backup" (que tem o mysqldump), todo dia no BACKUP_HORARIO ou com --agora.
 */

export interface ConfigBackup {
  databaseUrl: string;
  uploadsDir: string;
  pastaBackups: string;
  ambiente: string;
  diasLocal: number;
  diasNuvem: number;
  r2?: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint?: string };
}

export function configDoAmbiente(env = process.env): ConfigBackup {
  const r2 =
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
      ? {
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucket: env.R2_BUCKET,
          endpoint: env.R2_ENDPOINT || undefined, // só para testes com um S3 local
        }
      : undefined;
  return {
    databaseUrl: env.DATABASE_URL ?? "",
    uploadsDir: env.UPLOADS_DIR ?? path.resolve(__dirname, "../../uploads"),
    pastaBackups: env.BACKUP_DIR ?? path.resolve(__dirname, "../../backups"),
    ambiente: env.NODE_ENV ?? "development",
    diasLocal: Number(env.BACKUP_DIAS_LOCAL ?? 14),
    diasNuvem: Number(env.BACKUP_DIAS_NUVEM ?? 30),
    r2,
  };
}

const carimbo = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;

/** Roda um programa e falha com a saída de erro se ele terminar com código diferente de 0. */
export function executar(comando: string, args: string[], opcoes: { env?: NodeJS.ProcessEnv; saida?: NodeJS.WritableStream } = {}) {
  return new Promise<void>((resolve, reject) => {
    const filho = spawn(comando, args, { env: { ...process.env, ...opcoes.env }, stdio: ["ignore", opcoes.saida ? "pipe" : "ignore", "pipe"] });
    let erro = "";
    filho.stderr!.on("data", (d) => (erro += d.toString()));
    if (opcoes.saida) filho.stdout!.pipe(opcoes.saida);
    filho.on("error", reject);
    filho.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`${comando} saiu com código ${codigo}: ${erro.trim().slice(0, 500)}`))));
  });
}

export async function dumpDoBanco(config: ConfigBackup, destino: string) {
  const url = new URL(config.databaseUrl);
  const gzip = createGzip({ level: 9 });
  const arquivo = createWriteStream(destino);
  const gravando = pipeline(gzip, arquivo);
  await executar(
    "mysqldump",
    [
      `--host=${url.hostname}`,
      `--port=${url.port || "3306"}`,
      `--user=${decodeURIComponent(url.username)}`,
      "--single-transaction", // cópia consistente sem travar o banco
      "--routines",
      "--no-tablespaces",
      "--default-character-set=utf8mb4",
      url.pathname.slice(1),
    ],
    { env: { MYSQL_PWD: decodeURIComponent(url.password) }, saida: gzip }
  );
  await gravando;
}

async function pacoteDosDocumentos(config: ConfigBackup, destino: string) {
  if (!existsSync(config.uploadsDir)) await mkdir(config.uploadsDir, { recursive: true });
  await executar("tar", ["-czf", destino, "-C", config.uploadsDir, "."]);
}

async function limparLocais(config: ConfigBackup) {
  const limite = Date.now() - config.diasLocal * 86_400_000;
  let apagados = 0;
  for (const nome of await readdir(config.pastaBackups)) {
    if (!/^(banco|documentos)-.*\.(sql\.gz|tar\.gz)$/.test(nome)) continue;
    const caminho = path.join(config.pastaBackups, nome);
    if ((await stat(caminho)).mtimeMs < limite) {
      await rm(caminho);
      apagados++;
    }
  }
  return apagados;
}

function clienteR2(r2: NonNullable<ConfigBackup["r2"]>) {
  return new S3Client({
    region: "auto",
    endpoint: r2.endpoint ?? `https://${r2.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: !!r2.endpoint,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
}

async function enviarParaR2(config: ConfigBackup, arquivos: string[]) {
  const r2 = config.r2!;
  const s3 = clienteR2(r2);
  for (const arquivo of arquivos) {
    const { size } = await stat(arquivo);
    await s3.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: `${config.ambiente}/${path.basename(arquivo)}`,
        Body: createReadStream(arquivo),
        ContentLength: size,
      })
    );
  }
  // Retenção na nuvem
  const limite = Date.now() - config.diasNuvem * 86_400_000;
  const antigos: string[] = [];
  let continuacao: string | undefined;
  do {
    const pagina = await s3.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: `${config.ambiente}/`, ContinuationToken: continuacao }));
    for (const o of pagina.Contents ?? []) if (o.Key && o.LastModified && o.LastModified.getTime() < limite) antigos.push(o.Key);
    continuacao = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (continuacao);
  for (let i = 0; i < antigos.length; i += 1000) {
    await s3.send(new DeleteObjectsCommand({ Bucket: r2.bucket, Delete: { Objects: antigos.slice(i, i + 1000).map((Key) => ({ Key })) } }));
  }
  return antigos.length;
}

export interface ResultadoBackup {
  arquivos: { nome: string; bytes: number }[];
  apagadosLocais: number;
  enviadoParaNuvem: boolean;
  apagadosNaNuvem: number;
}

export async function fazerBackup(config = configDoAmbiente()): Promise<ResultadoBackup> {
  if (!config.databaseUrl) throw new Error("DATABASE_URL não definida");
  await mkdir(config.pastaBackups, { recursive: true });
  const quando = carimbo();
  const banco = path.join(config.pastaBackups, `banco-${config.ambiente}-${quando}.sql.gz`);
  const documentos = path.join(config.pastaBackups, `documentos-${config.ambiente}-${quando}.tar.gz`);
  await dumpDoBanco(config, banco);
  await pacoteDosDocumentos(config, documentos);
  const arquivos = await Promise.all([banco, documentos].map(async (a) => ({ nome: path.basename(a), bytes: (await stat(a)).size })));
  const apagadosLocais = await limparLocais(config);
  const apagadosNaNuvem = config.r2 ? await enviarParaR2(config, [banco, documentos]) : 0;
  return { arquivos, apagadosLocais, enviadoParaNuvem: !!config.r2, apagadosNaNuvem };
}
