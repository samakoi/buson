import "dotenv/config";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/password";

/**
 * Cria o primeiro administrador (produção/staging não usam o seed de demonstração).
 *   Desenvolvimento:  npm run criar-admin
 *   Docker:           docker compose ... run --rm api node dist/scripts/criarAdmin.js
 * Pergunta nome, e-mail e senha (a senha não aparece na tela).
 */

const prisma = new PrismaClient();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MINIMA = 10;

/** Linhas do stdin quando ele não é um terminal (ex.: testes automáticos). */
let linhasDoPipe: string[] | null = null;
async function lerDoPipe() {
  if (!linhasDoPipe) {
    let texto = "";
    for await (const parte of process.stdin) texto += parte;
    linhasDoPipe = texto.split(/\r?\n/);
  }
  return linhasDoPipe.shift() ?? "";
}

async function perguntar(texto: string): Promise<string> {
  process.stdout.write(texto);
  if (!process.stdin.isTTY) {
    const r = await lerDoPipe();
    process.stdout.write("\n");
    return r.trim();
  }
  const rl = createInterface({ input: process.stdin });
  const resposta = await new Promise<string>((resolve) => rl.once("line", resolve));
  rl.close();
  return resposta.trim();
}

/** Lê a senha sem mostrar o que é digitado. */
async function perguntarSenha(texto: string): Promise<string> {
  if (!process.stdin.isTTY) return (await perguntar(texto)).trim();
  process.stdout.write(texto);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let senha = "";
    const aoDigitar = (tecla: string) => {
      for (const c of tecla) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", aoDigitar);
          process.stdout.write("\n");
          return resolve(senha);
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(130); // Ctrl+C
        }
        if (c === "\u007f" || c === "\b") senha = senha.slice(0, -1);
        else senha += c;
      }
    };
    stdin.on("data", aoDigitar);
  });
}

async function principal() {
  console.log(`Criar administrador do Bus On (ambiente: ${process.env.NODE_ENV ?? "development"})\n`);
  const nome = await perguntar("Nome: ");
  if (nome.length < 3) throw new Error("Informe o nome completo.");
  const email = (await perguntar("E-mail: ")).toLowerCase();
  if (!EMAIL.test(email)) throw new Error("E-mail inválido.");
  const senha = await perguntarSenha(`Senha (mínimo ${SENHA_MINIMA} caracteres): `);
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
  if ((await perguntarSenha("Repita a senha: ")) !== senha) throw new Error("As senhas não conferem.");

  const existente = await prisma.usuario.findUnique({ where: { email }, select: { papel: true } });
  if (existente) throw new Error(`Já existe um usuário com esse e-mail (${existente.papel}). Nada foi alterado.`);

  const admin = await prisma.usuario.create({
    data: { nome, email, senhaHash: await hashPassword(senha), papel: "ADMIN" },
    select: { id: true },
  });
  await prisma.auditoria.create({
    // usuarioId vazio = feito pelo sistema (script no servidor)
    data: { acao: "CRIAR_ADMIN", entidade: "Usuario", entidadeId: admin.id, valorNovo: { nome, email, origem: "criar-admin" } },
  });
  console.log(`\nAdministrador criado: ${email}`);
}

principal()
  .catch((err) => {
    console.error(`\nErro: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
