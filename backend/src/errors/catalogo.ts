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

  VIAGEM_ENCERRADA: { status: 409, mensagem: "Esta viagem já foi encerrada." },

  // ---- Embarque (QR temporário do motorista)
  QR_INVALIDO: { status: 400, mensagem: "Embarque não autorizado: este QR Code não é desta viagem ou já foi substituído. Escaneie o QR que está na tela do motorista." },
  QR_EXPIRADO: { status: 400, mensagem: "Embarque não autorizado: o QR Code expirou. Peça ao motorista para atualizar o QR." },
  ROTA_INCOMPATIVEL: { status: 403, mensagem: "Embarque não autorizado: sua instituição não faz parte da rota desta viagem." },
  SEM_VAGA_CONFIRMADA: { status: 400, mensagem: "Embarque não autorizado: não há vaga confirmada nesta viagem." },
  EMBARQUE_JA_CONFIRMADO: { status: 409, mensagem: "O embarque já foi confirmado nesta viagem." },

  // ---- Alocação: pontos de embarque, programação semanal e dias do aluno
  ROTA_NAO_CADASTRADA: { status: 404, mensagem: "Rota não encontrada." },
  PONTO_EMBARQUE_NAO_ENCONTRADO: { status: 404, mensagem: "Ponto de embarque não encontrado." },
  PONTO_FORA_DA_ROTA: { status: 400, mensagem: "O ponto de embarque escolhido não faz parte desta rota." },
  PROGRAMACAO_NAO_ENCONTRADA: { status: 404, mensagem: "Programação não encontrada." },
  PROGRAMACAO_JA_ATIVA_NA_ROTA: { status: 409, mensagem: "Esta rota já tem uma programação ativa. Edite a existente." },
  HORARIO_VOLTA_INVALIDO: { status: 400, mensagem: "O horário da volta deve ser depois do horário da ida." },
  CAPACIDADE_INSUFICIENTE: { status: 409, mensagem: "O novo ônibus não comporta os alunos já alocados." },
  CONTA_NAO_ATIVA: { status: 403, mensagem: "Os dias de uso só podem ser escolhidos com a conta ativa (após a validação da matrícula)." },
  ROTA_NAO_ATENDE_INSTITUICAO: { status: 400, mensagem: "Esta rota não passa pela instituição do aluno." },
  DIA_SEM_TRANSPORTE: { status: 400, mensagem: "Não há transporte programado nesta rota em um dos dias escolhidos." },
  DIAS_LOTADOS: { status: 409, mensagem: "Não há mais vagas em um ou mais dias escolhidos. Escolha outro dia." },

  // ---- Documentos do aluno
  DOCUMENTO_NAO_ENCONTRADO: { status: 404, mensagem: "Documento não encontrado." },
  ARQUIVO_OBRIGATORIO: { status: 400, mensagem: "Envie o arquivo do documento." },
  TIPO_ARQUIVO_INVALIDO: { status: 400, mensagem: "Formato não aceito. Envie um PDF ou uma foto (JPG ou PNG)." },
  ARQUIVO_MUITO_GRANDE: { status: 413, mensagem: "O arquivo passa de 10 MB. Envie um arquivo menor." },
  DOCUMENTO_AGUARDANDO_ANALISE: { status: 409, mensagem: "Você já tem um documento aguardando análise. Espere o resultado antes de enviar outro." },
  DOCUMENTO_JA_ANALISADO: { status: 409, mensagem: "Este documento já foi analisado." },
  LINK_INVALIDO: { status: 403, mensagem: "Link do documento inválido ou expirado. Abra o documento de novo pelo app." },

  // ---- Faltas
  FALTA_NAO_ENCONTRADA: { status: 404, mensagem: "Falta não encontrada." },
  FALTA_JA_DECIDIDA: { status: 409, mensagem: "Esta falta já foi analisada pela administração." },
  JUSTIFICATIVA_JA_ENVIADA: { status: 409, mensagem: "Você já enviou a justificativa desta falta. Aguarde a análise." },
  PRAZO_JUSTIFICATIVA_ENCERRADO: { status: 409, mensagem: "O prazo para justificar esta falta terminou. Procure a administração do transporte." },
  ANEXO_NAO_ENCONTRADO: { status: 404, mensagem: "Esta falta não tem anexo." },

  // ---- Push
  PUSH_TOKEN_INVALIDO: { status: 400, mensagem: "Token de notificação inválido." },

  // ---- Relatórios e datas
  DATA_INVALIDA: { status: 400, mensagem: "Data inválida." },
  PERIODO_INVALIDO: { status: 400, mensagem: "A data final deve ser igual ou posterior à inicial." },
  PERIODO_MUITO_LONGO: { status: 400, mensagem: "O período máximo é de 366 dias." },
} as const satisfies Record<string, { status: number; mensagem: string }>;

export type CodigoErro = keyof typeof ERROS;
