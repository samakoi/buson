-- AlterTable
ALTER TABLE `notificacoes` ADD COLUMN `pushEnviadoEm` DATETIME(3) NULL,
    ADD COLUMN `pushStatus` ENUM('PENDENTE', 'ENVIANDO', 'ENVIADO', 'SEM_DISPOSITIVO', 'DESLIGADO', 'FALHOU', 'IGNORADO') NOT NULL DEFAULT 'PENDENTE',
    ADD COLUMN `pushTentativas` INTEGER NOT NULL DEFAULT 0,
    MODIFY `categoria` ENUM('GERAL', 'CADASTRO', 'DOCUMENTO', 'LEMBRETE', 'DIAS', 'FALTA', 'TRANSPORTE', 'LIBERACAO', 'ROTA', 'VIAGEM') NOT NULL DEFAULT 'GERAL';

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `pushDesligado` JSON NULL;

-- AlterTable
ALTER TABLE `viagens` ADD COLUMN `lembreteSaidaEm` DATETIME(3) NULL,
    ADD COLUMN `lembreteVesperaEm` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `dispositivos_push` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `plataforma` ENUM('ANDROID', 'IOS') NOT NULL,
    `deviceId` VARCHAR(100) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `motivoDesativacao` VARCHAR(100) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimoUsoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `dispositivos_push_token_key`(`token`),
    INDEX `dispositivos_push_usuarioId_ativo_idx`(`usuarioId`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `envios_push` (
    `id` VARCHAR(191) NOT NULL,
    `notificacaoId` VARCHAR(191) NOT NULL,
    `dispositivoId` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(100) NULL,
    `status` ENUM('ENVIADO', 'ENTREGUE', 'ERRO') NOT NULL,
    `erro` VARCHAR(200) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verificadoEm` DATETIME(3) NULL,

    INDEX `envios_push_status_verificadoEm_idx`(`status`, `verificadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notificacoes_pushStatus_criadoEm_idx` ON `notificacoes`(`pushStatus`, `criadoEm`);

-- AddForeignKey
ALTER TABLE `dispositivos_push` ADD CONSTRAINT `dispositivos_push_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_push` ADD CONSTRAINT `envios_push_notificacaoId_fkey` FOREIGN KEY (`notificacaoId`) REFERENCES `notificacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_push` ADD CONSTRAINT `envios_push_dispositivoId_fkey` FOREIGN KEY (`dispositivoId`) REFERENCES `dispositivos_push`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Avisos anteriores ao push: ficam só na aba Avisos (não são enviados ao celular)
UPDATE `notificacoes` SET `pushStatus` = 'IGNORADO';
