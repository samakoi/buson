<#
.SYNOPSIS
  Instala ou atualiza o Bus On (produção ou staging) nesta máquina, com volta automática se falhar.
.DESCRIPTION
  1. Backup do banco e dos documentos (se já houver uma versão rodando)
  2. Baixa o código (git fetch) e posiciona no commit pedido
  3. Monta a imagem da API marcada com o commit
  4. Aplica as migrations do banco (a versão antiga continua no ar enquanto isso)
  5. Sobe a nova versão e confere /api/v1/saude
  6. Se a nova versão não responder, volta para a anterior sozinho
  Rode numa cópia do repositório só para o servidor (ex.: C:\buson\producao), nunca na pasta de desenvolvimento.
.EXAMPLE
  .\deploy\atualizar.ps1 -Ambiente staging -Ref origin/fase-7-producao
  .\deploy\atualizar.ps1 -Ambiente producao
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('producao', 'staging')][string]$Ambiente,
    # Branch, tag ou commit. Padrão: o main do GitHub.
    [string]$Ref = 'origin/main',
    # Reinstala mesmo que já esteja nessa versão
    [switch]$Forcar
)
. "$PSScriptRoot\comum.ps1"
Iniciar-Ambiente $Ambiente
Set-Location $Raiz

function Rodar-Git { Executar 'git.exe' $args }

if (Rodar-Git status --porcelain --untracked-files=no) {
    throw "Há arquivos alterados nesta cópia do repositório ($Raiz). O servidor não deve ter mudanças locais."
}

$anterior = Versao-Atual
Write-Host "== Bus On $Ambiente | versão no ar: $(if ($anterior) { $anterior } else { 'nenhuma (primeira instalação)' })"

# 1. Código
Rodar-Git fetch --prune --quiet origin
$commit = Rodar-Git rev-parse --verify --quiet "$Ref^{commit}"
if (-not $commit) { throw "Não achei '$Ref' no repositório." }
$versao = Rodar-Git rev-parse --short=12 $commit
if ($versao -eq $anterior -and -not $Forcar) {
    Write-Host "Já está na versão $versao. Nada a fazer (use -Forcar para reinstalar)."
    exit 0
}

# 2. Backup antes de mexer em qualquer coisa
if ($anterior) { Fazer-Backup }

Rodar-Git checkout --quiet --detach $commit
try {
    # 3. Imagem nova (a antiga continua existindo para a volta)
    $env:APP_VERSAO = $versao
    Write-Host "Montando a imagem buson-api:$versao..."
    Compose build api

    # 4. Migrations, com a versão antiga ainda no ar
    Compose up -d --wait mysql
    Write-Host "Aplicando migrations..."
    Compose run --rm --no-deps api node_modules/.bin/prisma migrate deploy
} catch {
    if ($anterior) {
        Rodar-Git checkout --quiet --detach $anterior
        Registrar $Ambiente "FALHA antes de trocar a versão ($anterior -> $versao): $($_.Exception.Message). A versão $anterior continua no ar."
    } else {
        Registrar $Ambiente "FALHA na primeira instalação ($versao): $($_.Exception.Message)"
    }
    Write-Host "Se a falha foi numa migration, confira o banco; o backup de agora há pouco está em $(Pasta-Backups)."
    exit 1
}

# 5. Troca a versão
Write-Host "Subindo a versão $versao..."
Compose up -d --remove-orphans
if (Esperar-Api $versao) {
    Registrar $Ambiente "OK: $(if ($anterior) { $anterior } else { '(nova)' }) -> $versao ($Ref)"
} else {
    Write-Host "A versão $versao não respondeu em /api/v1/saude. Últimos logs:"
    Compose logs --tail 40 api
    if (-not $anterior) {
        Registrar $Ambiente "FALHA na primeira instalação ($versao): a API não respondeu."
        exit 1
    }
    # 6. Volta para a versão anterior
    Write-Host "Voltando para a versão $anterior..."
    Rodar-Git checkout --quiet --detach $anterior
    $env:APP_VERSAO = $anterior
    Compose up -d --remove-orphans
    if (Esperar-Api $anterior) {
        Registrar $Ambiente "VOLTOU: $versao falhou; $anterior de volta no ar."
    } else {
        Registrar $Ambiente "FALHA GRAVE: $versao falhou e $anterior também não respondeu. Veja: docker compose -p $Projeto logs api"
    }
    exit 1
}

# Guarda as 5 imagens mais recentes (as que estão em uso nunca são apagadas)
$imagens = & docker image ls buson-api --format '{{.Tag}}' | Where-Object { $_ -and $_ -ne $versao -and $_ -ne $anterior }
$imagens | Select-Object -Skip 3 | ForEach-Object {
    try { & docker image rm "buson-api:$_" *> $null } catch { }
}
exit 0
