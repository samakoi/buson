-- AlterTable
ALTER TABLE `universidades` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;

-- CreateTable
CREATE TABLE `localizacoes_viagem` (
    `id` VARCHAR(191) NOT NULL,
    `viagemId` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `velocidade` DOUBLE NULL,
    `direcao` DOUBLE NULL,
    `precisao` DOUBLE NULL,
    `registradoEm` DATETIME(3) NOT NULL,
    `recebidoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `localizacoes_viagem_viagemId_registradoEm_idx`(`viagemId`, `registradoEm`),
    INDEX `localizacoes_viagem_registradoEm_idx`(`registradoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `localizacoes_viagem` ADD CONSTRAINT `localizacoes_viagem_viagemId_fkey` FOREIGN KEY (`viagemId`) REFERENCES `viagens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Posições que estavam na própria viagem viram o primeiro ponto do histórico
INSERT INTO `localizacoes_viagem` (`id`, `viagemId`, `latitude`, `longitude`, `registradoEm`)
SELECT UUID(), `id`, `latitude`, `longitude`, CURRENT_TIMESTAMP(3)
FROM `viagens`
WHERE `latitude` IS NOT NULL AND `longitude` IS NOT NULL;

-- AlterTable
ALTER TABLE `viagens` DROP COLUMN `latitude`,
    DROP COLUMN `longitude`;
