/**
 * Catálogo único de erros da API. Cada situação tem um código estável (usado
 * pelo app e pelos testes) e uma mensagem padrão em português — o mesmo erro
 * sempre responde com o mesmo código e o mesmo texto.
 */
export const ERROS = {
  // ---- Genéricos
  VALIDACAO: { status: 400, mensagem: "Dados inválidos." },
  NAO_AUTENTICADO: { status: 401, mensagem: "Faça login para continuar." },
  TOKEN_INVALIDO: { status: 401, mensagem: "Sua sessão expirou. Entre novamente." },
  SEM_PERMISSAO: { status: 403, mensagem: "Você não tem permissão para esta ação." },
  ORIGEM_NAO_PERMITIDA: { status: 403, mensagem: "Origem não permitida." },
  NAO_ENCONTRADO: { status: 404, mensagem: "Registro não encontrado." },
  ROTA_NAO_ENCONTRADA: { status: 404, mensagem: "Endereço não encontrado na API." },
  DUPLICADO: { status: 409, mensagem: "Já existe um cadastro com esses dados." },
  EM_USO: { status: 409, mensagem: "Este registro está em uso e não pode ser removido (ou referencia algo que não existe)." },
  MUITAS_TENTATIVAS: { status: 429, mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
  ERRO_INTERNO: { status: 500, mensagem: "Erro interno do servidor." },

  // ---- Autenticação e sessões
  CREDENCIAIS_INVALIDAS: { status: 401, mensagem: "E-mail ou senha inválidos." },
  REFRESH_INVALIDO: { status: 401, mensagem: "Sua sessão expirou. Entre novamente." },
  SESSAO_REVOGADA: { status: 401, mensagem: "Esta sessão foi encerrada. Entre novamente." },
  SESSAO_NAO_ENCONTRADA: { status: 404, mensagem: "Sessão não encontrada." },
  EMAIL_JA_CADASTRADO: { status: 409, mensagem: "Este e-mail já está cadastrado." },
  USUARIO_NAO_ENCONTRADO: { status: 404, mensagem: "Usuário não encontrado." },

  // ---- Perfis e cadastros
  PERFIL_ALUNO_NAO_ENCONTRADO: { status: 404, mensagem: "Perfil de aluno não encontrado para este usuário." },
  PERFIL_MOTORISTA_NAO_ENCONTRADO: { status: 404, mensagem: "Perfil de motorista não encontrado para este usuário." },
  ALUNO_NAO_ENCONTRADO: { status: 404, mensagem: "Aluno não encontrado." },
  MOTORISTA_NAO_ENCONTRADO: { status: 404, mensagem: "Motorista não encontrado." },
  ONIBUS_NAO_ENCONTRADO: { status: 404, mensagem: "Ônibus não encontrado." },
  MATRICULA_JA_CADASTRADA: { status: 409, mensagem: "Esta matrícula já está cadastrada para outro aluno." },
  MOTORISTA_COM_VIAGENS: { status: 409, mensagem: "Este motorista tem viagens cadastradas e não pode ser removido." },
  CONTA_INATIVA: { status: 403, mensagem: "Sua conta está inativa. Procure a administração do transporte." },

  // ---- Viagens
  VIAGEM_NAO_ENCONTRADA: { status: 404, mensagem: "Viagem não encontrada." },
  VIAGEM_DE_OUTRO_MOTORISTA: { status: 403, mensagem: "Você não é o motorista responsável por esta viagem." },
  DATA_PASSADA: { status: 400, mensagem: "Não é possível criar viagens em datas passadas." },
  VAGAS_ACIMA_DA_CAPACIDADE: { status: 400, mensagem: "O número de vagas é maior que a capacidade do ônibus." },
  VIAGEM_NAO_PODE_SER_EXCLUIDA: { status: 409, mensagem: "Só é possível excluir viagens que ainda não começaram." },
  CHECKIN_FECHADO: { status: 409, mensagem: "O check-in e o cancelamento só são aceitos antes de a viagem começar." },
  CHECKIN_JA_ATIVO: { status: 409, mensagem: "Você já possui check-in ativo nesta viagem." },
  CHECKIN_NAO_ENCONTRADO: { status: 404, mensagem: "Nenhum check-in ativo encontrado para cancelar." },
  VIAGEM_NAO_INICIADA: { status: 409, mensagem: "A viagem ainda não foi iniciada." },
  INICIO_INVALIDO: { status: 409, mensagem: "Só é possível iniciar uma viagem que ainda está aguardando." },
  ENCERRAMENTO_INVALIDO: { status: 409, mensagem: "Só é possível encerrar uma viagem em andamento." },
  ONIBUS_EM_MANUTENCAO: { status: 409, mensagem: "O ônibus desta viagem está em manutenção. Fale com a administração." },

  // ---- Embarque
  QR_NAO_RECONHECIDO: { status: 404, mensagem: "QR Code não reconhecido." },
  SEM_VAGA_CONFIRMADA: { status: 400, mensagem: "Este aluno não possui vaga confirmada nesta viagem." },
  EMBARQUE_JA_CONFIRMADO: { status: 409, mensagem: "O embarque deste aluno já foi confirmado." },

  // ---- Relatórios e datas
  DATA_INVALIDA: { status: 400, mensagem: "Data inválida." },
  PERIODO_INVALIDO: { status: 400, mensagem: "A data final deve ser igual ou posterior à inicial." },
  PERIODO_MUITO_LONGO: { status: 400, mensagem: "O período máximo é de 366 dias." },
} as const satisfies Record<string, { status: number; mensagem: string }>;

export type CodigoErro = keyof typeof ERROS;
