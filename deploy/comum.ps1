# Funções usadas pelos scripts de deploy do Bus On (carregado com ". $PSScriptRoot\comum.ps1").
# Compatível com o Windows PowerShell 5.1 e com o PowerShell 7.

$ErrorActionPreference = 'Stop'
$Deploy = $PSScriptRoot
$Raiz = Split-Path $Deploy -Parent
$Perfis = @()

function Ler-Env([string]$Arquivo) {
    $valores = @{}
    foreach ($linha in Get-Content -LiteralPath $Arquivo -Encoding UTF8) {
        if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $valores[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $valores
}

function Iniciar-Ambiente([string]$Ambiente) {
    $arquivo = Join-Path $Deploy ".env.$Ambiente"
    if (-not (Test-Path -LiteralPath $arquivo)) {
        throw "Não achei $arquivo. Crie com: .\deploy\gerar-segredos.ps1 -Ambiente $Ambiente"
    }
    $script:ArquivoEnv = $arquivo
    $script:Projeto = "buson-$Ambiente"
    $script:Config = Ler-Env $arquivo
    if (-not $Config.PORTA_LOCAL) { throw "PORTA_LOCAL não definida em $arquivo" }
    if ($Config.TUNNEL_TOKEN) { $script:Perfis = @('--profile', 'tunel') } else { $script:Perfis = @() }
}

# Roda um programa e para o script se ele falhar. O docker e o git escrevem o progresso na
# saída de erro: no PowerShell 5.1 isso não pode virar exceção, então vale só o código de saída.
function Executar([string]$Programa, [object[]]$Argumentos) {
    $antes = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Programa @Argumentos 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $antes }
    if ($LASTEXITCODE -ne 0) { throw "$Programa $($Argumentos -join ' ') falhou (código $LASTEXITCODE)" }
}

# docker compose já com o projeto, o arquivo e o ambiente certos
function Compose {
    if (-not $env:APP_VERSAO) { throw 'APP_VERSAO não definida: nenhuma versão da API foi escolhida (o compose montaria uma imagem "dev").' }
    Executar 'docker' (@('compose', '-p', $Projeto, '-f', (Join-Path $Deploy 'docker-compose.yml'), '--env-file', $ArquivoEnv) + $Perfis + $args)
}

# Para comandos que conversam com o usuário (precisam do terminal direto, sem filtro na saída)
function Compose-Interativo {
    if (-not $env:APP_VERSAO) { throw 'APP_VERSAO não definida.' }
    & docker compose -p $Projeto -f (Join-Path $Deploy 'docker-compose.yml') --env-file $ArquivoEnv @Perfis @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') falhou (código $LASTEXITCODE)" }
}

# Versão (commit) da API que está rodando agora, ou $null se não houver.
# Consulta o Docker direto pelos rótulos do compose (não depende das variáveis do ambiente).
function Versao-Atual {
    $imagem = & docker ps --filter "label=com.docker.compose.project=$Projeto" --filter 'label=com.docker.compose.service=api' --format '{{.Image}}' | Select-Object -First 1
    if ($imagem -match '^buson-api:(.+)$' -and $Matches[1] -ne 'dev') { return $Matches[1] }
    return $null
}

# Espera a API responder em /saude (e, se informado, com a versão esperada).
function Esperar-Api([string]$Versao, [int]$Segundos = 120) {
    $url = "http://127.0.0.1:$($Config.PORTA_LOCAL)/api/v1/saude"
    $limite = (Get-Date).AddSeconds($Segundos)
    while ((Get-Date) -lt $limite) {
        try {
            $r = Invoke-RestMethod -Uri $url -TimeoutSec 5
            if ($r.data) { $r = $r.data } # a API responde no envelope { data }
            if ($r.api -eq 'ok' -and $r.banco -eq 'ok' -and (-not $Versao -or $r.versao -eq $Versao)) { return $true }
        } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Pasta-Backups {
    $pasta = $Config.PASTA_BACKUPS
    if (-not $pasta) { throw "PASTA_BACKUPS não definida em $ArquivoEnv" }
    if (-not [System.IO.Path]::IsPathRooted($pasta)) { $pasta = Join-Path $Deploy $pasta }
    return [System.IO.Path]::GetFullPath($pasta)
}

function Fazer-Backup {
    $env:APP_VERSAO = Versao-Atual
    if (-not $env:APP_VERSAO) { throw "A API de $Projeto não está rodando; não há o que copiar." }
    Write-Host "Fazendo backup de $Projeto (banco + documentos)..."
    Compose run --rm backup node dist/backup/agendador.js --agora
}

function Registrar([string]$Ambiente, [string]$Mensagem) {
    $linha = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Mensagem
    Add-Content -LiteralPath (Join-Path $Deploy "historico-$Ambiente.log") -Value $linha -Encoding UTF8
    Write-Host $Mensagem
}
