-- Fase 12: a rota passa a ter dois trechos (IDA e VOLTA), cada um com origem, destino e paradas próprias,
-- e exclusão lógica (excluidaEm). Os dados atuais viram a IDA e são copiados para a VOLTA; a migration
-- pode rodar com a versão anterior da API no ar (as colunas novas têm valor padrão).

-- Rota: versão para edição concorrente e exclusão lógica
ALTER TABLE `rotas` ADD COLUMN `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `excluidaEm` DATETIME(3) NULL;
CREATE INDEX `rotas_excluidaEm_idx` ON `rotas`(`excluidaEm`);

-- Paradas por sentido (o que já existe fica como IDA)
ALTER TABLE `pontos_rota` ADD COLUMN `sentido` ENUM('IDA', 'VOLTA') NOT NULL DEFAULT 'IDA';
ALTER TABLE `rota_pontos_embarque` ADD COLUMN `sentido` ENUM('IDA', 'VOLTA') NOT NULL DEFAULT 'IDA';
CREATE UNIQUE INDEX `pontos_rota_rotaId_sentido_universidadeId_key` ON `pontos_rota`(`rotaId`, `sentido`, `universidadeId`);
-- O índice novo vem antes de apagar o antigo: a chave estrangeira de rotaId precisa de um índice
CREATE UNIQUE INDEX `rota_pontos_embarque_rotaId_sentido_pontoEmbarqueId_key` ON `rota_pontos_embarque`(`rotaId`, `sentido`, `pontoEmbarqueId`);
DROP INDEX `rota_pontos_embarque_rotaId_pontoEmbarqueId_key` ON `rota_pontos_embarque`;

-- Trechos
CREATE TABLE `trechos_rota` (
    `id` VARCHAR(191) NOT NULL,
    `rotaId` VARCHAR(191) NOT NULL,
    `sentido` ENUM('IDA', 'VOLTA') NOT NULL,
    `origem` VARCHAR(80) NOT NULL,
    `destino` VARCHAR(80) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `trechos_rota_rotaId_sentido_key`(`rotaId`, `sentido`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `trechos_rota` ADD CONSTRAINT `trechos_rota_rotaId_fkey` FOREIGN KEY (`rotaId`) REFERENCES `rotas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados atuais: a VOLTA começa igual à IDA (instituições na mesma ordem, que é como a volta funcionava;
-- pontos de embarque na ordem inversa, de volta aos bairros). NOT EXISTS evita cópia em dobro.
INSERT INTO `pontos_rota` (`id`, `rotaId`, `universidadeId`, `ordem`, `sentido`)
SELECT UUID(), p.`rotaId`, p.`universidadeId`, p.`ordem`, 'VOLTA'
FROM `pontos_rota` p
WHERE p.`sentido` = 'IDA'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `rotaId` FROM `pontos_rota` WHERE `sentido` = 'VOLTA') v WHERE v.`rotaId` = p.`rotaId`);

INSERT INTO `rota_pontos_embarque` (`id`, `rotaId`, `pontoEmbarqueId`, `ordem`, `sentido`)
SELECT UUID(), p.`rotaId`, p.`pontoEmbarqueId`, c.`n` + 1 - p.`ordem`, 'VOLTA'
FROM `rota_pontos_embarque` p
JOIN (SELECT `rotaId`, MAX(`ordem`) AS `n` FROM `rota_pontos_embarque` WHERE `sentido` = 'IDA' GROUP BY `rotaId`) c ON c.`rotaId` = p.`rotaId`
WHERE p.`sentido` = 'IDA'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `rotaId` FROM `rota_pontos_embarque` WHERE `sentido` = 'VOLTA') v WHERE v.`rotaId` = p.`rotaId`);

-- Origem e destino iniciais: ida = do primeiro ponto de embarque (ou o nome da rota) até a última
-- instituição; volta = o inverso. O administrador ajusta depois na tela da viagem.
INSERT INTO `trechos_rota` (`id`, `rotaId`, `sentido`, `origem`, `destino`)
SELECT UUID(), r.`id`, 'IDA',
  LEFT(COALESCE((SELECT pe.`nome` FROM `rota_pontos_embarque` x JOIN `pontos_embarque` pe ON pe.`id` = x.`pontoEmbarqueId`
                 WHERE x.`rotaId` = r.`id` AND x.`sentido` = 'IDA' ORDER BY x.`ordem` LIMIT 1), r.`nome`), 80),
  LEFT(COALESCE((SELECT u.`nome` FROM `pontos_rota` x JOIN `universidades` u ON u.`id` = x.`universidadeId`
                 WHERE x.`rotaId` = r.`id` AND x.`sentido` = 'IDA' ORDER BY x.`ordem` DESC LIMIT 1), r.`nome`), 80)
FROM `rotas` r
WHERE NOT EXISTS (SELECT 1 FROM `trechos_rota` t WHERE t.`rotaId` = r.`id` AND t.`sentido` = 'IDA');

INSERT INTO `trechos_rota` (`id`, `rotaId`, `sentido`, `origem`, `destino`)
SELECT UUID(), t.`rotaId`, 'VOLTA', t.`destino`, t.`origem`
FROM `trechos_rota` t
WHERE t.`sentido` = 'IDA'
  AND NOT EXISTS (SELECT 1 FROM (SELECT `rotaId` FROM `trechos_rota` WHERE `sentido` = 'VOLTA') v WHERE v.`rotaId` = t.`rotaId`);
