<#
.SYNOPSIS
  Cria deploy/.env.<ambiente> a partir do .env.example, com senhas aleatórias.
.EXAMPLE
  .\deploy\gerar-segredos.ps1 -Ambiente producao
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('producao', 'staging')][string]$Ambiente
)
. "$PSScriptRoot\comum.ps1"

$destino = Join-Path $Deploy ".env.$Ambiente"
if (Test-Path -LiteralPath $destino) {
    throw "$destino já existe e não será sobrescrito (a senha do MySQL precisa continuar igual à do banco já criado)."
}

function Segredo([int]$Bytes) {
    $b = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($b)
    $rng.Dispose()
    # base64url: só letras, números, - e _ (seguro dentro da DATABASE_URL)
    return [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$texto = [System.IO.File]::ReadAllText((Join-Path $Deploy '.env.example'), [System.Text.Encoding]::UTF8)
$texto = $texto -replace '(?m)^JWT_SECRET=__GERAR__', ('JWT_SECRET=' + (Segredo 48))
$texto = $texto -replace '(?m)^MYSQL_SENHA=__GERAR__', ('MYSQL_SENHA=' + (Segredo 24))
$texto = $texto -replace '(?m)^MYSQL_SENHA_ROOT=__GERAR__', ('MYSQL_SENHA_ROOT=' + (Segredo 24))
if ($Ambiente -eq 'staging') {
    $texto = $texto -replace '(?m)^NODE_ENV=production', 'NODE_ENV=staging'
    $texto = $texto -replace '(?m)^PORTA_LOCAL=4000', 'PORTA_LOCAL=4001'
    $texto = $texto -replace '(?m)^PASTA_BACKUPS=\.\./backups/producao', 'PASTA_BACKUPS=../backups/staging'
}
[System.IO.File]::WriteAllText($destino, $texto, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Criado: $destino"
Write-Host "Senhas geradas. Agora complete no arquivo: TUNNEL_TOKEN, R2_*, SENTRY_DSN (veja o GUIA_INSTALACAO.md, seção 10)."
Write-Host "Guarde uma cópia desse arquivo num lugar seguro (gerenciador de senhas): as senhas do MySQL e as chaves do R2 estão só nele."
