-- Fase 1: embarque pelo QR temporário do motorista (sessões de embarque) e histórico de embarques
-- CreateTable
CREATE TABLE `boarding_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `viagemId` VARCHAR(191) NOT NULL,
    `motoristaId` VARCHAR(191) NOT NULL,
    `onibusId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `boarding_sessions_tokenHash_key`(`tokenHash`),
    INDEX `boarding_sessions_viagemId_ativa_idx`(`viagemId`, `ativa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `embarques` (
    `id` VARCHAR(191) NOT NULL,
    `viagemId` VARCHAR(191) NOT NULL,
    `alunoId` VARCHAR(191) NOT NULL,
    `metodo` ENUM('QR_MOTORISTA', 'MANUAL') NOT NULL,
    `sessaoId` VARCHAR(191) NULL,
    `registradoPorId` VARCHAR(191) NULL,
    `dataHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `embarques_viagemId_alunoId_key`(`viagemId`, `alunoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `boarding_sessions` ADD CONSTRAINT `boarding_sessions_viagemId_fkey` FOREIGN KEY (`viagemId`) REFERENCES `viagens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boarding_sessions` ADD CONSTRAINT `boarding_sessions_motoristaId_fkey` FOREIGN KEY (`motoristaId`) REFERENCES `motoristas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boarding_sessions` ADD CONSTRAINT `boarding_sessions_onibusId_fkey` FOREIGN KEY (`onibusId`) REFERENCES `onibus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `embarques` ADD CONSTRAINT `embarques_viagemId_fkey` FOREIGN KEY (`viagemId`) REFERENCES `viagens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `embarques` ADD CONSTRAINT `embarques_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `alunos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `embarques` ADD CONSTRAINT `embarques_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `boarding_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Histórico: embarques já confirmados antes desta versão entram como MANUAL
INSERT INTO `embarques` (`id`, `viagemId`, `alunoId`, `metodo`, `dataHora`, `criadoEm`) SELECT UUID(), `viagemId`, `alunoId`, 'MANUAL', `atualizadoEm`, `atualizadoEm` FROM `checkins` WHERE `embarcado` = true;
