import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { configDoAmbiente, executar } from "./backup";

/**
 * Restaura um backup feito pelo agendador (roda no container "restaurar", chamado pelo restaurar.ps1):
 *   node dist/backup/restaurar.js --banco banco-production-2026-09-29_0300.sql.gz [--documentos documentos-....tar.gz]
 * O banco é recriado do zero (DROP + CREATE) e recebe o dump; a pasta de documentos é trocada pelo pacote.
 * Os arquivos são lidos de BACKUP_DIR (/backups no container).
 */

function argumento(nome: string) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Só nomes de arquivo do próprio backup (sem pastas), para não ler nada fora de BACKUP_DIR. */
function arquivoDoBackup(pasta: string, nome: string | undefined, padrao: RegExp) {
  if (!nome || !padrao.test(nome)) throw new Error(`Arquivo inválido: ${nome ?? "(vazio)"}`);
  const caminho = path.join(pasta, nome);
  if (!existsSync(caminho)) throw new Error(`Arquivo não encontrado na pasta de backups: ${nome}`);
  return caminho;
}

function mysql(url: URL, args: string[], entrada?: NodeJS.ReadableStream) {
  return new Promise<void>((resolve, reject) => {
    const filho = spawn(
      "mysql",
      [`--host=${url.hostname}`, `--port=${url.port || "3306"}`, `--user=${decodeURIComponent(url.username)}`, "--default-character-set=utf8mb4", ...args],
      { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: [entrada ? "pipe" : "ignore", "inherit", "pipe"] }
    );
    let erro = "";
    filho.stderr!.on("data", (d) => (erro += d.toString()));
    filho.on("error", reject);
    filho.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`mysql saiu com código ${codigo}: ${erro.trim().slice(0, 500)}`))));
    if (entrada) pipeline(entrada, filho.stdin!).catch(reject);
  });
}

async function restaurarBanco(databaseUrl: string, arquivo: string) {
  const url = new URL(databaseUrl);
  const banco = url.pathname.slice(1);
  if (!/^\w+$/.test(banco)) throw new Error("Nome de banco inválido na DATABASE_URL");
  await mysql(url, ["-e", `DROP DATABASE IF EXISTS \`${banco}\`; CREATE DATABASE \`${banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]);
  await mysql(url, [banco], createReadStream(arquivo).pipe(createGunzip()));
}

async function restaurarDocumentos(pastaUploads: string, arquivo: string) {
  // Confere o pacote antes de apagar os documentos atuais
  await executar("tar", ["-tzf", arquivo]);
  for (const nome of await readdir(pastaUploads)) await rm(path.join(pastaUploads, nome), { recursive: true, force: true });
  await executar("tar", ["-xzf", arquivo, "-C", pastaUploads]);
  // Este container roda como root; a API roda como "node"
  if (process.getuid?.() === 0) await executar("chown", ["-R", "node:node", pastaUploads]);
}

async function principal() {
  const config = configDoAmbiente();
  if (!config.databaseUrl) throw new Error("DATABASE_URL não definida");
  const banco = arquivoDoBackup(config.pastaBackups, argumento("banco"), /^banco-[\w.-]+\.sql\.gz$/);
  const nomeDocs = argumento("documentos");
  const documentos = nomeDocs ? arquivoDoBackup(config.pastaBackups, nomeDocs, /^documentos-[\w.-]+\.tar\.gz$/) : undefined;

  console.log(`Restaurando o banco a partir de ${path.basename(banco)}...`);
  await restaurarBanco(config.databaseUrl, banco);
  if (documentos) {
    console.log(`Restaurando os documentos a partir de ${path.basename(documentos)}...`);
    await restaurarDocumentos(config.uploadsDir, documentos);
  }
  console.log("Restauração concluída.");
}

principal().catch((err) => {
  console.error(`Erro na restauração: ${(err as Error).message}`);
  process.exit(1);
});
