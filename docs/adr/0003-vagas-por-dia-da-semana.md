# 0003. Vagas por dia da semana, com viagens geradas da programação

- Status: Aceito
- Data: 2026-09-28

## Contexto

No MVP, a administração criava cada viagem e a vaga era disputada viagem a viagem. A operação real é semanal: o mesmo
ônibus faz a mesma rota nos mesmos dias, e há mais alunos cadastrados do que lugares, desde que cada dia respeite a
capacidade.

## Decisão

- A administração cadastra uma **programação semanal** por rota (ônibus, motorista, horários, dias).
- O aluno escolhe **dias fixos**; a capacidade é conferida por dia, em transação travando a programação.
- Um agendador gera as viagens de **ida e volta** dos próximos dias (idempotente) e coloca os alunos alocados como
  `PROGRAMADO`. Quem não tem o dia fixo pode pedir vaga avulsa, com lista de espera.
- Faltas são registradas ao encerrar a ida, com justificativa e decisão da administração.

## Consequências

- A administração não precisa criar viagens no dia a dia; a ocupação semanal aparece no dashboard.
- A capacidade passa a depender de dois níveis (dia fixo e viagem), o que exigiu testes E2E de concorrência.
- O agendador roda dentro da API: com mais de uma instância, precisaria de um lock ou de um processo separado.
