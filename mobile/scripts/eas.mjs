// Roda o EAS CLI (npx eas-cli ...) liberando o repositório para o git SÓ neste comando.
//
// Em discos como o E: do Windows, o git recusa repositórios de outro "dono" ("dubious ownership")
// e o EAS entende que não há repositório. Em vez de mudar a configuração global do git, passamos
// safe.directory por variáveis de ambiente, que valem só para este processo.
//
//   node scripts/eas.mjs build -p android --profile staging
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizDoRepositorio = path.resolve(fileURLToPath(new URL("../..", import.meta.url))).replace(/\\/g, "/");

export function rodarEas(args, envExtra = {}) {
  const env = {
    ...process.env,
    ...envExtra,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "safe.directory",
    GIT_CONFIG_VALUE_0: raizDoRepositorio,
  };
  const todos = ["eas-cli", ...args];
  // No Windows o npx é um .cmd e precisa do shell: cada argumento vai entre aspas
  const r =
    process.platform === "win32"
      ? // (o "npx" vai sem aspas: com aspas o npx.cmd não acha a própria pasta)
        spawnSync(["npx", ...todos.map((a) => `"${String(a).replace(/"/g, '\\"')}"`)].join(" "), { stdio: "inherit", env, shell: true })
      : spawnSync("npx", todos, { stdio: "inherit", env });
  return r.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(rodarEas(process.argv.slice(2)));
}
