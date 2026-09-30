// Publica uma atualização pela internet (EAS Update) para os APKs já instalados.
//
//   npm run atualizacao -- staging "Corrige o texto da tela de faltas"
//   npm run atualizacao -- producao "Corrige o texto da tela de faltas"
//
// Usa as MESMAS variáveis do perfil de build no eas.json (endereço da API, variante do app),
// para a atualização nunca apontar o app de produção para o staging (ou o contrário).
// Só chega aos APKs com o mesmo código nativo (runtimeVersion "fingerprint"); se mudou algo
// nativo (plugin, permissão, biblioteca nativa), gere um APK novo e suba a versão mínima na API.
import { readFileSync } from "node:fs";
import { rodarEas } from "./eas.mjs";

const [destino, ...resto] = process.argv.slice(2);
const mensagem = resto.join(" ").trim();
const perfis = { staging: "staging", producao: "production" };
if (!perfis[destino] || !mensagem) {
  console.error('Uso: npm run atualizacao -- <staging|producao> "o que mudou"');
  process.exit(2);
}

const perfil = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")).build[perfis[destino]];
console.log(`Publicando no canal "${perfil.channel}" (API ${perfil.env.EXPO_PUBLIC_API_URL})...`);

const args = ["update", "--channel", perfil.channel, "--environment", perfil.environment, "--message", mensagem, "--platform", "android"];
process.exit(rodarEas(args, perfil.env));
