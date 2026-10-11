-- AlterTable
ALTER TABLE `viagens` ADD COLUMN `encerradaEm` DATETIME(3) NULL,
    ADD COLUMN `iniciadaEm` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `viagens_data_horario_idx` ON `viagens`(`data`, `horario`);
