import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

app.listen(env.port, () => {
  logger.info({ porta: env.port, ambiente: env.ambiente }, `Bus On API rodando em http://localhost:${env.port}/api/v1`);
});
