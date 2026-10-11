// Gera o site (PWA) do Bus On em mobile/dist, pronto para o Cloudflare Pages.
//
//   npm run build:web -- producao     → app.onbus.online, fala com api.onbus.online
//   npm run build:web -- staging      → app-staging.onbus.online, fala com api-staging.onbus.online
//   npm run build:web -- staging --api http://localhost:3333/api/v1   → teste local contra outra API
//
// No Cloudflare Pages o ambiente vai no próprio comando de build (ou na variável BUSON_WEB).
// Usa as MESMAS variáveis dos perfis do eas.json (endereço da API, variante, ambiente), para o site e
// o APK de um ambiente nunca apontarem para APIs diferentes.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const perfis = { producao: "production", staging: "staging" };

const destino = (process.argv[2]?.startsWith("--") ? undefined : process.argv[2]) ?? process.env.BUSON_WEB;
if (!perfis[destino]) {
  console.error("Uso: npm run build:web -- <producao|staging>  (ou a variável BUSON_WEB)");
  process.exit(2);
}
const perfil = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")).build[perfis[destino]];
// --api: só para testar o site no computador (http só vale para localhost)
const iApi = process.argv.indexOf("--api");
if (iApi > 0) perfil.env.EXPO_PUBLIC_API_URL = process.argv[iApi + 1];
const api = perfil.env.EXPO_PUBLIC_API_URL;
if (!/^(https:\/\/[^/]+|http:\/\/localhost:\d+)\/api\/v1$/.test(api)) {
  console.error(`EXPO_PUBLIC_API_URL inválida no perfil ${perfis[destino]}: ${api}`);
  process.exit(1);
}
const origemApi = new URL(api).origin;
console.log(`Site ${destino}: API ${api}`);

// 1) Exporta o app para web (as variáveis EXPO_PUBLIC_* entram no código nesta hora)
rmSync(DIST, { recursive: true, force: true });
const env = { ...process.env, ...perfil.env, EXPO_NO_TELEMETRY: "1" };
const r =
  process.platform === "win32"
    ? spawnSync("npx expo export --platform web --clear", { cwd: RAIZ, env, stdio: "inherit", shell: true })
    : spawnSync("npx", ["expo", "export", "--platform", "web", "--clear"], { cwd: RAIZ, env, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

// 1b) O Cloudflare Pages não publica pastas chamadas node_modules: as fontes de ícones e as imagens que
//     vêm de bibliotecas (dist/assets/node_modules/...) chegavam como a página HTML e os ícones sumiam.
//     Move a pasta e corrige os caminhos dentro dos arquivos JS. A troca é sempre a mesma, então o nome
//     com hash de cada arquivo continua correspondendo a um único conteúdo (o cache de 1 ano segue válido).
const PASTA_BIBLIOTECAS = "pacotes";
if (existsSync(DIST + "assets/node_modules")) {
  renameSync(DIST + "assets/node_modules", DIST + "assets/" + PASTA_BIBLIOTECAS);
  for (const arquivo of readdirSync(DIST, { recursive: true })) {
    if (!/\.(js|html|css|json)$/.test(arquivo)) continue;
    const caminho = path.join(DIST, arquivo);
    const conteudo = readFileSync(caminho, "utf8");
    if (conteudo.includes("/assets/node_modules/")) {
      writeFileSync(caminho, conteudo.replaceAll("/assets/node_modules/", `/assets/${PASTA_BIBLIOTECAS}/`));
    }
  }
}
const restantes = readdirSync(DIST, { recursive: true }).filter((a) => a.split(/[\\/]/).includes("node_modules"));
if (restantes.length) {
  console.error("Arquivos dentro de node_modules não seriam publicados pelo Cloudflare Pages:", restantes);
  process.exit(1);
}

// 2) App de teste com outro nome e outra cor, para ninguém confundir com o oficial
if (destino === "staging") {
  const manifesto = JSON.parse(readFileSync(DIST + "manifest.json", "utf8"));
  Object.assign(manifesto, { name: "Bus On Teste", short_name: "Bus On Teste", theme_color: "#C2410C" });
  writeFileSync(DIST + "manifest.json", JSON.stringify(manifesto, null, 2) + "\n");
  const html = readFileSync(DIST + "index.html", "utf8")
    .replace("<title>Bus On</title>", "<title>Bus On Teste</title>")
    .replace('content="#1E5AA8"', 'content="#C2410C"')
    .replace('name="apple-mobile-web-app-title" content="Bus On"', 'name="apple-mobile-web-app-title" content="Bus On Teste"');
  writeFileSync(DIST + "index.html", html);
}

// 3) Cabeçalhos do Cloudflare Pages: segurança (o login fica no navegador, então nada de scripts de fora)
//    e cache (arquivos com hash ficam 1 ano; a página sempre confere se há versão nova).
// Versão do leitor de QR usado nos navegadores sem BarcodeDetector (iPhone): baixa o .wasm desse caminho
const zxing = JSON.parse(readFileSync(new URL("../node_modules/zxing-wasm/package.json", import.meta.url), "utf8")).version;
const csp = [
  "default-src 'self'",
  // Leaflet (mapa) só nesse arquivo exato (e conferido por hash); blob: = o código do mapa no iframe;
  // 'wasm-unsafe-eval' = leitor de QR em WebAssembly
  // + o contador de visitas do Cloudflare (Web Analytics, sem dados pessoais), que o Pages injeta sozinho
  "script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js https://static.cloudflareinsights.com",
  // O React Native Web gera estilos em linha
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${origemApi} https://fastly.jsdelivr.net/npm/zxing-wasm@${zxing}/ https://cloudflareinsights.com`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
writeFileSync(
  DIST + "_headers",
  `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), geolocation=(self), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000

/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable

/manifest.json
  Cache-Control: public, max-age=3600
`
);
console.log(`\nPronto: ${DIST} (site ${destino})`);
