// ESLint do app (roda no CI): configuração oficial da Expo.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([expoConfig, { ignores: ["dist/*", ".expo/*", "web-build/*"] }]);
