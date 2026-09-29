import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "../config/env";

/**
 * Onde os arquivos enviados ficam guardados. O banco guarda só a "chave" (caminho
 * relativo) e os metadados; o conteúdo fica aqui, fora da pasta pública da API.
 *
 * Hoje: disco local (UPLOADS_DIR). Em produção dá para trocar por S3, Cloudflare R2,
 * Azure Blob ou GCS implementando esta mesma interface — as regras não mudam.
 */
export interface Armazenamento {
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  abrir(chave: string): Promise<{ conteudo: Readable; tamanho: number }>;
  remover(chave: string): Promise<void>;
}

class ArmazenamentoLocal implements Armazenamento {
  constructor(private readonly raiz: string) {}

  /** Resolve a chave dentro da raiz, recusando qualquer tentativa de sair dela (../). */
  private caminho(chave: string) {
    const completo = path.resolve(this.raiz, chave);
    if (!completo.startsWith(this.raiz + path.sep)) throw new Error(`Chave de arquivo inválida: ${chave}`);
    return completo;
  }

  async salvar(chave: string, conteudo: Buffer) {
    const destino = this.caminho(chave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, conteudo, { flag: "wx" }); // nunca sobrescreve
  }

  async abrir(chave: string) {
    const origem = this.caminho(chave);
    const { size } = await stat(origem);
    return { conteudo: createReadStream(origem), tamanho: size };
  }

  async remover(chave: string) {
    await rm(this.caminho(chave), { force: true });
  }
}

export const armazenamento: Armazenamento = new ArmazenamentoLocal(env.uploadsDir);
