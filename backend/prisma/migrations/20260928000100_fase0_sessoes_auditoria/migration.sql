-- Fase 0: sessões por dispositivo (refresh token com rotação) e auditoria com antes/depois
-- AlterTable
ALTER TABLE `auditorias` ADD COLUMN `valorAnterior` JSON NULL,
    ADD COLUMN `valorNovo` JSON NULL;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `deviceId` VARCHAR(100) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `revogadoEm` DATETIME(3) NULL,
    `substituidoPorId` VARCHAR(191) NULL,
    `ultimoUsoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_usuarioId_revogadoEm_idx`(`usuarioId`, `revogadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

