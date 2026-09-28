-- Fase 1: dados acadêmicos e status da conta do aluno, notificações por usuário
-- (3 perfis) com categoria, e auditoria. Migração de dados escrita à mão para
-- preservar as notificações existentes.

-- Aluno: dados acadêmicos + status da conta
ALTER TABLE `alunos` ADD COLUMN `curso` VARCHAR(191) NULL,
    ADD COLUMN `fotoArquivo` VARCHAR(191) NULL,
    ADD COLUMN `matricula` VARCHAR(191) NULL,
    ADD COLUMN `statusConta` ENUM('PENDENTE', 'ATIVO', 'INATIVO') NOT NULL DEFAULT 'PENDENTE',
    ADD COLUMN `telefone` VARCHAR(191) NULL;

-- Quem já usava o app continua ativo (novos cadastros entram como PENDENTE)
UPDATE `alunos` SET `statusConta` = 'ATIVO';

CREATE UNIQUE INDEX `alunos_matricula_key` ON `alunos`(`matricula`);

-- Notificações: de aluno para usuário, copiando o vínculo existente
ALTER TABLE `notificacoes` DROP FOREIGN KEY `notificacoes_alunoId_fkey`;
ALTER TABLE `notificacoes`
    ADD COLUMN `usuarioId` VARCHAR(191) NULL,
    ADD COLUMN `categoria` ENUM('GERAL', 'CADASTRO', 'DOCUMENTO', 'LEMBRETE', 'DIAS', 'FALTA', 'TRANSPORTE', 'LIBERACAO', 'ROTA') NOT NULL DEFAULT 'GERAL',
    MODIFY `mensagem` VARCHAR(500) NOT NULL;
UPDATE `notificacoes` n JOIN `alunos` a ON a.`id` = n.`alunoId` SET n.`usuarioId` = a.`usuarioId`;
DELETE FROM `notificacoes` WHERE `usuarioId` IS NULL;
ALTER TABLE `notificacoes` MODIFY `usuarioId` VARCHAR(191) NOT NULL, DROP COLUMN `alunoId`;
CREATE INDEX `notificacoes_usuarioId_lida_idx` ON `notificacoes`(`usuarioId`, `lida`);
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Auditoria (Regra 10)
CREATE TABLE `auditorias` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NOT NULL,
    `detalhes` JSON NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditorias_entidade_entidadeId_idx`(`entidade`, `entidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `auditorias` ADD CONSTRAINT `auditorias_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
