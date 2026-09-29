<#
.SYNOPSIS
  Cria um administrador no ambiente (o primeiro admin de produção nasce aqui).
  Pergunta nome, e-mail e senha; a senha não aparece na tela.
.EXAMPLE
  .\deploy\criar-admin.ps1 -Ambiente producao
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('producao', 'staging')][string]$Ambiente
)
. "$PSScriptRoot\comum.ps1"
Iniciar-Ambiente $Ambiente

$env:APP_VERSAO = Versao-Atual
if (-not $env:APP_VERSAO) { throw "A API de $Projeto não está rodando. Instale primeiro com o atualizar.ps1." }
Compose-Interativo run --rm --no-deps api node dist/scripts/criarAdmin.js
