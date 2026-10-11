# 0004. Docker numa máquina própria + Cloudflare Tunnel, Pages e R2

- Status: Aceito
- Data: 2026-09-29

## Contexto

O projeto precisa de produção e de um ambiente de teste com custo próximo de zero, HTTPS, backups fora da máquina e
sem expor portas da rede local.

## Decisão

- API, MySQL e backup em **Docker Compose** numa máquina Windows, um projeto por ambiente (produção e staging), cada
  um com segredos, volumes e túnel próprios.
- Acesso pela internet só pelo **Cloudflare Tunnel** (sem porta aberta no roteador; a API escuta em `127.0.0.1`).
- Backups diários com cópia no **Cloudflare R2**; site estático no **Cloudflare Pages**.
- Atualização por script (`atualizar.ps1`): backup, migrations, troca de versão e volta automática se a saúde falhar.

## Consequências

- Custo baixo e controle total dos dados (documentos e GPS são dados pessoais).
- A disponibilidade depende da máquina e da conexão do local: exige energia estável, BitLocker, monitoramento externo
  (UptimeRobot) e teste mensal de restauração.
- Escalar para mais de uma máquina exigiria trocar o armazenamento local de arquivos por um objeto (a interface
  `Armazenamento` já isola isso) e tirar os agendadores do processo da API.
