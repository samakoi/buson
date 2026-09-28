import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`🚌 Bus On API rodando em http://localhost:${env.port}`);
  console.log(`   Documentação rápida: http://localhost:${env.port}/api`);
});
