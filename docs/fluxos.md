# Fluxos de uso

Como cada perfil usa o Bus On, do primeiro acesso ao dia a dia. Os diagramas são Mermaid (o GitHub desenha sozinho).
As regras por trás de cada passo estão em [api.md](./api.md#regras-de-negócio-principais).

## 1. Entrada no app

```mermaid
flowchart TD
  A([Abre o app ou o site]) --> B{Já tem sessão salva?}
  B -- sim --> P{Perfil}
  B -- não --> L[Tela de login]
  L -->|e-mail e senha| P
  L -->|Criar conta de aluno| C[Cadastro: nome, e-mail, senha forte, universidade]
  C --> CA[Conta criada como PENDENTE e já entra no app]
  CA --> P
  P -- Aluno --> AL[Abas: Início · Embarcar · Ônibus · Avisos · Perfil]
  P -- Motorista --> MO[Abas: Painel · Embarque · Passageiros · Rota · Avisos]
  P -- Administração --> AD[Abas: Dashboard · Alunos · Viagens · Cadastros · Avisos]
```

- **Senha forte** ao criar conta: 8+ caracteres, com maiúscula, minúscula, número e caractere especial (a tela marca
  cada item enquanto a pessoa digita).
- Motoristas não se cadastram: a administração cria a conta. O primeiro administrador é criado no servidor
  (`criar-admin`).
- A sessão se renova sozinha; "Sair de todos os aparelhos" encerra todas as sessões.

## 2. Aluno: do cadastro à vaga garantida

```mermaid
flowchart TD
  A([Conta PENDENTE]) --> B[Perfil › Dados acadêmicos: matrícula, curso, telefone]
  B --> C[Perfil › Documentação: envia o comprovante de matrícula<br/>foto, galeria ou PDF]
  C --> D{Administração analisa}
  D -- reprova com motivo --> E[Aviso com o motivo] --> C
  D -- aprova --> F([Conta ATIVA])
  A -. enquanto aguarda .-> V[Pode pedir vaga avulsa nas viagens do dia<br/>com lista de espera]
  F --> G[Perfil › Meus dias: escolhe os dias fixos e o ponto de embarque]
  G --> H{Há lugar no ônibus nesses dias?}
  H -- dia lotado --> I[Dia bloqueado: escolhe outro] --> G
  H -- sim --> J([Vaga garantida nos dias escolhidos])
  J --> K[As viagens de ida e volta desses dias<br/>já chegam com a vaga do aluno]
```

## 3. Aluno: o dia da viagem

```mermaid
flowchart TD
  A([Lembrete na véspera e 1 h antes]) --> B[Início: viagem do dia]
  B --> C{Vai hoje?}
  C -- sim --> D[Confirmar presença]
  C -- não --> E[Não vou hoje + motivo]
  E --> F[Ausência avisada: não conta como falta<br/>a vaga vai para o primeiro da espera]
  B -. sem dia fixo .-> W[Pedir vaga avulsa]
  W --> X{Há vaga?}
  X -- sim --> D
  X -- não --> Y[Entra na lista de espera e vê a posição] -->|alguém libera a vaga| Z[Aviso: você conseguiu a vaga] --> D
  D --> G[Ver onde está o ônibus: mapa e distância até o ponto]
  G --> H[Aba Embarcar: escaneia o QR mostrado pelo motorista]
  H --> I([Embarque confirmado])
  D -. não embarcou .-> J[Motorista encerra a ida]
  J --> K[Falta registrada e a vaga da volta é liberada]
  K --> L[Perfil › Minhas faltas: justifica em até 7 dias<br/>texto + anexo opcional]
  L --> M{Administração decide}
  M -- aceita --> N([Falta justificada])
  M -- indefere com motivo --> O([Falta mantida])
```

## 4. Motorista: a viagem

```mermaid
flowchart TD
  A([Painel: viagens do dia]) --> B[Confere vagas, confirmados e quem está na espera]
  B --> C{Ônibus em manutenção?}
  C -- sim --> D[Não pode iniciar: falar com a administração]
  C -- não --> E[Iniciar viagem]
  E --> F[Compartilha o GPS até encerrar<br/>no APK também com a tela apagada]
  E --> G[Aba Embarque: mostra o QR temporário]
  G --> H[Alunos escaneiam e embarcam]
  E --> I[Aba Passageiros: confirma manualmente quem está sem celular]
  E --> J[Aba Rota: paradas do dia; as sem alunos aparecem para pular]
  H & I & J --> K[Encerrar viagem]
  K --> L([Quem tinha vaga e não embarcou recebe falta])
```

## 5. Administração

```mermaid
flowchart LR
  subgraph Cadastros
    C1[Universidades e pontos<br/>com localização] --> C2[Rotas com a ordem das paradas]
    C3[Ônibus e capacidade] --> C4[Motoristas<br/>senha inicial forte]
    C3 --> C5[Manutenção liga/desliga<br/>avisa os alunos afetados]
  end
  subgraph Viagens
    V1[Programação semanal<br/>rota, ônibus, motorista, horários, dias] --> V2[Viagens de ida e volta<br/>geradas para os próximos dias]
    V3[Viagem avulsa] --> V2
    V2 --> V4[Histórico: período e filtros]
    V4 --> V5[Detalhe: horários, números,<br/>passageiros e trajeto no mapa]
  end
  subgraph Alunos
    A1[Busca e filtros] --> A2[Perfil do aluno]
    A2 --> A3[Aprovar ou reprovar documento]
    A2 --> A4[Ativar ou inativar a conta]
    A2 --> A5[Ajustar os dias fixos]
    A2 --> A6[Faltas e histórico de alterações]
  end
  subgraph Acompanhamento
    D1[Dashboard: ocupação por dia,<br/>presença e faltas do período] --> D2[Faltas: decidir justificativas]
    D1 --> D3[Mapa ao vivo dos ônibus]
  end
  C2 --> V1
  C4 --> V1
```

## 6. Ciclo da viagem e da vaga

```mermaid
stateDiagram-v2
  [*] --> AGUARDANDO: gerada pela programação ou criada avulsa
  AGUARDANDO --> EM_ANDAMENTO: motorista inicia
  AGUARDANDO --> [*]: administração exclui (avisa quem tinha vaga)
  EM_ANDAMENTO --> ENCERRADA: motorista encerra (faltas registradas)
  ENCERRADA --> [*]
```

```mermaid
stateDiagram-v2
  [*] --> PROGRAMADO: dia fixo do aluno
  [*] --> CONFIRMADO: vaga avulsa com lugar
  [*] --> ESPERA: vaga avulsa sem lugar
  PROGRAMADO --> CONFIRMADO: confirma presença
  ESPERA --> CONFIRMADO: alguém libera a vaga
  PROGRAMADO --> CANCELADO: não vou hoje (ausência avisada)
  CONFIRMADO --> CANCELADO: não vou hoje (ausência avisada)
  PROGRAMADO --> EMBARCOU: escaneia o QR
  CONFIRMADO --> EMBARCOU: escaneia o QR ou confirmação manual
  CONFIRMADO --> FALTA: viagem encerrada sem embarque
  PROGRAMADO --> FALTA: viagem encerrada sem embarque
```

## 7. Avisos

Cada evento gera um aviso na aba **Avisos** (com contador) e, no APK, uma notificação no celular:

| Para quem | Quando |
|---|---|
| Aluno | documento em análise, aprovado ou reprovado; conta ativada ou inativada; vaga confirmada, liberada ou conseguida na espera; mudanças nos dias fixos e na rota; lembretes da viagem; ônibus em manutenção; viagem cancelada; falta registrada e decisão da justificativa |
| Motorista | lembretes das viagens dele (na véspera e antes da saída, com o número de passageiros) |
| Administração | aluno novo cadastrado, documento para analisar, justificativa de falta enviada, aluno com 3 faltas sem justificativa em 30 dias |

Em *Avisos › ⚙* cada pessoa desliga os lembretes e os avisos de vaga no celular; os avisos de cadastro, documentos,
faltas e viagem cancelada sempre chegam.
