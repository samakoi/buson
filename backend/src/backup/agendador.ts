import "../instrumentacao"; // Sentry: avisa se o backup falhar
import { registrarErro } from "../instrumentacao";
import { configDoAmbiente, fazerBackup } from "./backup";

/**
 * Processo do container "backup":
 *   node dist/backup/agendador.js          → roda todo dia no BACKUP_HORARIO (padrão 03:00)
 *   node dist/backup/agendador.js --agora  → faz um backup agora e termina (usado antes de atualizar)
 */

const log = (nivel: "info" | "error", msg: string, extra: object = {}) =>
  console.log(JSON.stringify({ level: nivel === "info" ? 30 : 50, time: new Date().toISOString(), servico: "bus-on-backup", msg, ...extra }));

async function rodar() {
  const inicio = Date.now();
  try {
    const r = await fazerBackup(configDoAmbiente());
    log("info", "Backup concluído", { ...r, segundos: Math.round((Date.now() - inicio) / 1000) });
    return true;
  } catch (err) {
    log("error", "Falha no backup", { erro: (err as Error).message });
    registrarErro(err, { rota: "backup" });
    return false;
  }
}

/** Milissegundos até o próximo HH:MM (hoje ou amanhã). */
function ateProximo(horario: string) {
  const [h, m] = horario.split(":").map(Number);
  const alvo = new Date();
  alvo.setHours(h, m, 0, 0);
  if (alvo.getTime() <= Date.now()) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime() - Date.now();
}

async function principal() {
  if (process.argv.includes("--agora")) {
    process.exit((await rodar()) ? 0 : 1);
  }
  const horario = /^([01]\d|2[0-3]):[0-5]\d$/.test(process.env.BACKUP_HORARIO ?? "") ? process.env.BACKUP_HORARIO! : "03:00";
  log("info", "Agendador de backup ligado", { horario, nuvem: !!configDoAmbiente().r2 });
  const agendar = () =>
    setTimeout(async () => {
      await rodar();
      agendar();
    }, ateProximo(horario));
  agendar();
}

void principal();
