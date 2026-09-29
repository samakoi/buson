-- AlterTable
ALTER TABLE `checkins` ADD COLUMN `pontoEmbarqueId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('CONFIRMADO', 'PROGRAMADO', 'ESPERA', 'CANCELADO') NOT NULL DEFAULT 'CONFIRMADO';

-- AlterTable
ALTER TABLE `viagens` ADD COLUMN `programacaoId` VARCHAR(191) NULL,
    ADD COLUMN `sentido` ENUM('IDA', 'VOLTA') NOT NULL DEFAULT 'IDA';

-- CreateTable
CREATE TABLE `pontos_embarque` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `endereco` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pontos_embarque_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rota_pontos_embarque` (
    `id` VARCHAR(191) NOT NULL,
    `rotaId` VARCHAR(191) NOT NULL,
    `pontoEmbarqueId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL,

    UNIQUE INDEX `rota_pontos_embarque_rotaId_pontoEmbarqueId_key`(`rotaId`, `pontoEmbarqueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `programacoes` (
    `id` VARCHAR(191) NOT NULL,
    `rotaId` VARCHAR(191) NOT NULL,
    `onibusId` VARCHAR(191) NOT NULL,
    `motoristaId` VARCHAR(191) NOT NULL,
    `horarioIda` VARCHAR(191) NOT NULL,
    `horarioVolta` VARCHAR(191) NULL,
    `diasSemana` JSON NOT NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `programacoes_rotaId_ativa_idx`(`rotaId`, `ativa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alocacoes_aluno` (
    `id` VARCHAR(191) NOT NULL,
    `alunoId` VARCHAR(191) NOT NULL,
    `diaSemana` INTEGER NOT NULL,
    `rotaId` VARCHAR(191) NOT NULL,
    `pontoEmbarqueId` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `alocacoes_aluno_rotaId_diaSemana_ativo_idx`(`rotaId`, `diaSemana`, `ativo`),
    UNIQUE INDEX `alocacoes_aluno_alunoId_diaSemana_key`(`alunoId`, `diaSemana`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `viagens_programacaoId_sentido_data_key` ON `viagens`(`programacaoId`, `sentido`, `data`);

-- AddForeignKey
ALTER TABLE `rota_pontos_embarque` ADD CONSTRAINT `rota_pontos_embarque_rotaId_fkey` FOREIGN KEY (`rotaId`) REFERENCES `rotas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rota_pontos_embarque` ADD CONSTRAINT `rota_pontos_embarque_pontoEmbarqueId_fkey` FOREIGN KEY (`pontoEmbarqueId`) REFERENCES `pontos_embarque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programacoes` ADD CONSTRAINT `programacoes_rotaId_fkey` FOREIGN KEY (`rotaId`) REFERENCES `rotas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programacoes` ADD CONSTRAINT `programacoes_onibusId_fkey` FOREIGN KEY (`onibusId`) REFERENCES `onibus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programacoes` ADD CONSTRAINT `programacoes_motoristaId_fkey` FOREIGN KEY (`motoristaId`) REFERENCES `motoristas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alocacoes_aluno` ADD CONSTRAINT `alocacoes_aluno_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `alunos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alocacoes_aluno` ADD CONSTRAINT `alocacoes_aluno_rotaId_fkey` FOREIGN KEY (`rotaId`) REFERENCES `rotas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alocacoes_aluno` ADD CONSTRAINT `alocacoes_aluno_pontoEmbarqueId_fkey` FOREIGN KEY (`pontoEmbarqueId`) REFERENCES `pontos_embarque`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `viagens` ADD CONSTRAINT `viagens_programacaoId_fkey` FOREIGN KEY (`programacaoId`) REFERENCES `programacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_pontoEmbarqueId_fkey` FOREIGN KEY (`pontoEmbarqueId`) REFERENCES `pontos_embarque`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

