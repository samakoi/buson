# 0009. Rota com trechos de ida e volta e exclusão lógica

- Status: Aceito
- Data: 2026-10-11

## Contexto

Toda viagem programada tem ida e volta, mas a rota tinha uma lista só de paradas para os dois sentidos e era cadastrada
à parte. A administração não conseguia ajustar a volta (outra ordem, outras paradas) nem configurar tudo na mesma tela.
Além disso, excluir uma rota falhava sempre que havia viagens (a chave estrangeira impedia), e sem viagens a exclusão
apagava em cascata os dias fixos dos alunos, sem aviso.

## Decisão

- A rota passa a ter dois **trechos** (`trechos_rota`, únicos por rota e sentido) com origem e destino, e as paradas
  ganham `sentido`, com ordem própria. Os horários continuam na programação (`horarioIda`, `horarioVolta`): não há dado
  duplicado. Na ida os alunos embarcam nos pontos e descem nas instituições; na volta, o inverso.
- A programação cria e edita a rota junto, na mesma transação. A API ainda aceita o formato antigo (uma lista para os
  dois sentidos) para as versões anteriores do app.
- **Exclusão lógica** (`excluidaEm`): a rota some das listas e das novas escolhas; as viagens feitas, presenças,
  faltas e auditoria continuam. A exclusão cancela as viagens futuras com aviso, encerra a programação e libera os dias
  fixos pela regra existente (`revisarAlocacoes`). Com vínculos, a API exige confirmação explícita; com viagem em
  andamento, recusa.
- Edição concorrente: `atualizadoEm` lido pela tela vai como `versao`; versão antiga é recusada (409).

## Consequências

- Ida e volta são configuradas juntas e podem divergir quando a operação pedir.
- Todo código que lê paradas precisa escolher o sentido (alocação usa a ida; embarque, GPS e rota do dia usam o sentido
  da viagem).
- Rotas excluídas continuam no banco; instituições e pontos ficam livres (as paradas da rota excluída são desvinculadas).
- Horário por ponto de parada não existe no modelo; se for necessário, entra em `pontos_rota`/`rota_pontos_embarque`.
