<#
.SYNOPSIS
  Faz um backup agora (banco + documentos) e envia ao R2 se estiver configurado.
  O backup automático já roda todo dia no BACKUP_HORARIO; use este antes de mexer em algo.
.EXAMPLE
  .\deploy\backup-agora.ps1 -Ambiente producao
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('producao', 'staging')][string]$Ambiente
)
. "$PSScriptRoot\comum.ps1"
Iniciar-Ambiente $Ambiente

Fazer-Backup
$pasta = Pasta-Backups
Write-Host "`nBackups mais recentes em ${pasta}:"
Get-ChildItem -LiteralPath $pasta -File | Sort-Object LastWriteTime -Descending | Select-Object -First 4 |
    Format-Table Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } }, LastWriteTime -AutoSize | Out-Host
