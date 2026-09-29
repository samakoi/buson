<#
.SYNOPSIS
  Restaura um backup (banco e, opcionalmente, documentos). APAGA os dados atuais do ambiente.
.DESCRIPTION
  Sem -Banco, só lista os backups disponíveis. Antes de restaurar, faz um backup de segurança
  do estado atual. Para usar um backup baixado do R2, coloque o arquivo na PASTA_BACKUPS.
.EXAMPLE
  .\deploy\restaurar.ps1 -Ambiente producao
  .\deploy\restaurar.ps1 -Ambiente producao -Banco banco-production-2026-09-29_0300.sql.gz -Documentos documentos-production-2026-09-29_0300.tar.gz
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('producao', 'staging')][string]$Ambiente,
    [string]$Banco,
    [string]$Documentos,
    # Pula a pergunta de confirmação (só para automação)
    [switch]$Confirmado
)
. "$PSScriptRoot\comum.ps1"
Iniciar-Ambiente $Ambiente
$pasta = Pasta-Backups

if (-not $Banco) {
    Write-Host "Backups em ${pasta}:"
    Get-ChildItem -LiteralPath $pasta -File -Filter '*.gz' | Sort-Object LastWriteTime -Descending | Select-Object -First 20 |
        Format-Table Name, @{ n = 'MB'; e = { [math]::Round($_.Length / 1MB, 2) } }, LastWriteTime -AutoSize | Out-Host
    Write-Host "Para restaurar: .\deploy\restaurar.ps1 -Ambiente $Ambiente -Banco <banco-...sql.gz> [-Documentos <documentos-...tar.gz>]"
    exit 0
}
foreach ($nome in @($Banco, $Documentos) | Where-Object { $_ }) {
    if (-not (Test-Path -LiteralPath (Join-Path $pasta $nome))) { throw "Não achei $nome em $pasta" }
}

$versao = Versao-Atual
if (-not $versao) { throw "A API de $Projeto não está rodando. Instale primeiro com o atualizar.ps1." }
if (-not $Confirmado) {
    Write-Host "ATENÇÃO: o banco$(if ($Documentos) { ' e os documentos' }) de '$Ambiente' serão substituídos por:" -ForegroundColor Yellow
    Write-Host "  $Banco"
    if ($Documentos) { Write-Host "  $Documentos" }
    if ((Read-Host "Digite '$Ambiente' para confirmar") -ne $Ambiente) { Write-Host 'Cancelado.'; exit 1 }
}

# Backup de segurança do estado atual (dá para desfazer a restauração com ele)
Fazer-Backup

Write-Host 'Parando a API e o backup automático...'
Compose stop api backup
$argumentos = @('--banco', $Banco)
if ($Documentos) { $argumentos += @('--documentos', $Documentos) }
try {
    Compose --profile manutencao run --rm restaurar node dist/backup/restaurar.js @argumentos
    # Um backup antigo pode ser de antes de alguma migration: completa o banco
    Compose run --rm --no-deps api node_modules/.bin/prisma migrate deploy
} finally {
    Write-Host 'Subindo a API de novo...'
    Compose up -d
}
if (Esperar-Api $versao) {
    Registrar $Ambiente "RESTAURADO: $Banco$(if ($Documentos) { " + $Documentos" }) (versão $versao)"
} else {
    Registrar $Ambiente "RESTAURADO, mas a API não respondeu: veja docker compose -p $Projeto logs api"
    exit 1
}
