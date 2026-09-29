-- AlterTable
ALTER TABLE `checkins` ADD COLUMN `canceladoEm` DATETIME(3) NULL,
    ADD COLUMN `motivoAusencia` ENUM('DOENCA', 'COMPROMISSO_ACADEMICO', 'COMPROMISSO_PESSOAL', 'TRABALHO', 'TRANSPORTE_PROPRIO', 'OUTRO', 'FALTOU_NA_IDA') NULL;

-- CreateTable
CREATE TABLE `faltas` (
    `id` VARCHAR(191) NOT NULL,
    `alunoId` VARCHAR(191) NOT NULL,
    `viagemId` VARCHAR(191) NOT NULL,
    `status` ENUM('REGISTRADA', 'JUSTIFICADA', 'INDEFERIDA') NOT NULL DEFAULT 'REGISTRADA',
    `prazoJustificativa` DATETIME(3) NOT NULL,
    `justificativa` VARCHAR(500) NULL,
    `justificadaEm` DATETIME(3) NULL,
    `anexoArquivo` VARCHAR(191) NULL,
    `anexoNome` VARCHAR(191) NULL,
    `anexoMimeType` VARCHAR(191) NULL,
    `anexoTamanho` INTEGER NULL,
    `decididoPorId` VARCHAR(191) NULL,
    `decididoEm` DATETIME(3) NULL,
    `observacaoDecisao` VARCHAR(300) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `faltas_alunoId_criadoEm_idx`(`alunoId`, `criadoEm`),
    INDEX `faltas_status_idx`(`status`),
    UNIQUE INDEX `faltas_viagemId_alunoId_key`(`viagemId`, `alunoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `faltas` ADD CONSTRAINT `faltas_alunoId_fkey` FOREIGN KEY (`alunoId`) REFERENCES `alunos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faltas` ADD CONSTRAINT `faltas_viagemId_fkey` FOREIGN KEY (`viagemId`) REFERENCES `viagens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faltas` ADD CONSTRAINT `faltas_decididoPorId_fkey` FOREIGN KEY (`decididoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Faltas antigas: até aqui a falta era calculada na hora (vaga confirmada/programada
-- e não embarcou em viagem encerrada). Passa a existir como registro, para os
-- relatórios continuarem com os mesmos números.
INSERT INTO `faltas` (`id`, `alunoId`, `viagemId`, `status`, `prazoJustificativa`, `criadoEm`)
SELECT UUID(), c.`alunoId`, c.`viagemId`, 'REGISTRADA', DATE_ADD(v.`data`, INTERVAL 7 DAY), v.`data`
FROM `checkins` c
JOIN `viagens` v ON v.`id` = c.`viagemId`
WHERE v.`status` = 'ENCERRADA'
  AND c.`status` IN ('CONFIRMADO', 'PROGRAMADO')
  AND c.`embarcado` = false;
