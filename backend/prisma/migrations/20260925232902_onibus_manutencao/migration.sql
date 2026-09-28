-- AlterTable
ALTER TABLE `onibus` ADD COLUMN `emManutencao` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `observacaoManutencao` VARCHAR(191) NULL;
