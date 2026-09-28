-- Fase 2: documentos de comprovação de matrícula
-- CreateTable
CREATE TABLE `documentos` (
    `id` VARCHAR(191) NOT NULL,
    `alunoId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('DECLARACAO', 'COMPROVANTE', 'OUTRO') NOT NULL,
    `arquivo` VARCHAR(191) NOT NULL,
    `nomeOriginal` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `tamanho` INTEGER NOT NULL,
    `status` ENUM('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REPROVADO') NOT NULL DEFAULT 'PENDENTE',
    `motivoReprovacao` VARCHAR(300) NULL,
    `analisadoPorId` VARCHAR(191) NULL,
    `analisadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documentos_alunoId_criadoEm_idx`(`alunoId`, `criadoEm`),
    INDEX `documentos_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `alunos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_analisadoPorId_fkey` FOREIGN KEY (`analisadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

