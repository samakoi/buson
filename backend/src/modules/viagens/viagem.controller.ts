import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import * as viagemService from "./viagem.service";
import { AppError } from "../../errors/AppError";

async function getAlunoId(usuarioId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  return aluno.id;
}

async function getMotoristaId(usuarioId: string) {
  const motorista = await prisma.motorista.findUnique({ where: { usuarioId } });
  if (!motorista) throw new AppError("PERFIL_MOTORISTA_NAO_ENCONTRADO");
  return motorista.id;
}

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).");

const listarQuerySchema = z.object({ desde: dia.optional() });

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const filtro = listarQuerySchema.parse(req.query);
    const viagens = await viagemService.listarViagens(req.usuario!, filtro);
    res.json(viagens);
  } catch (err) {
    next(err);
  }
}

const novaViagemSchema = z.object({
  rotaId: z.string().uuid("Selecione a rota."),
  onibusId: z.string().uuid("Selecione o ônibus."),
  motoristaId: z.string().uuid("Selecione o motorista."),
  data: dia,
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM)."),
  vagas: z.number().int().positive("As vagas devem ser maiores que zero.").optional(),
  sentido: z.enum(["IDA", "VOLTA"]).optional(),
});

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const dados = novaViagemSchema.parse(req.body);
    const viagem = await viagemService.criarViagem(dados, req.usuario!.sub);
    res.status(201).json(viagem);
  } catch (err) {
    next(err);
  }
}

export async function excluir(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await viagemService.excluirViagem(req.params.id, req.usuario!.sub));
  } catch (err) {
    next(err);
  }
}

export async function atual(req: Request, res: Response, next: NextFunction) {
  try {
    const viagem = await viagemService.viagemAtual(req.usuario!);
    res.json(viagem);
  } catch (err) {
    next(err);
  }
}

export async function checkin(req: Request, res: Response, next: NextFunction) {
  try {
    const alunoId = await getAlunoId(req.usuario!.sub);
    const resultado = await viagemService.fazerCheckin(req.params.id, alunoId);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

const cancelamentoSchema = z.object({
  motivo: z.enum(["DOENCA", "COMPROMISSO_ACADEMICO", "COMPROMISSO_PESSOAL", "TRABALHO", "TRANSPORTE_PROPRIO", "OUTRO"]).optional(),
  diaTodo: z.boolean().optional(),
});

export async function cancelarCheckin(req: Request, res: Response, next: NextFunction) {
  try {
    const alunoId = await getAlunoId(req.usuario!.sub);
    const opcoes = cancelamentoSchema.parse(req.body ?? {});
    const resultado = await viagemService.cancelarCheckin(req.params.id, alunoId, opcoes);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function passageiros(req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await viagemService.listarPassageiros(req.params.id, req.usuario!);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function rotaDoDia(req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await viagemService.calcularRotaDoDia(req.params.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function iniciar(req: Request, res: Response, next: NextFunction) {
  try {
    const motoristaId = await getMotoristaId(req.usuario!.sub);
    const resultado = await viagemService.iniciarViagem(req.params.id, motoristaId);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function encerrar(req: Request, res: Response, next: NextFunction) {
  try {
    const motoristaId = await getMotoristaId(req.usuario!.sub);
    const resultado = await viagemService.encerrarViagem(req.params.id, motoristaId);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

const localizacaoSchema = z.object({ latitude: z.number(), longitude: z.number() });

export async function localizacao(req: Request, res: Response, next: NextFunction) {
  try {
    const motoristaId = await getMotoristaId(req.usuario!.sub);
    const { latitude, longitude } = localizacaoSchema.parse(req.body);
    const resultado = await viagemService.atualizarLocalizacao(req.params.id, motoristaId, latitude, longitude);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
