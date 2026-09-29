import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import * as viagemService from "./viagem.service";
import * as localizacaoService from "../gps/localizacao.service";
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

// ---- GPS (Fase 6)

const leituraSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  velocidade: z.number().min(0).max(100).nullable().optional(), // m/s (até 360 km/h)
  direcao: z.number().min(0).max(360).nullable().optional(),
  precisao: z.number().min(0).nullable().optional(),
  registradoEm: z.coerce.date(),
});

/** Lote de leituras do GPS do motorista (ou uma leitura só, no formato antigo). */
const localizacaoSchema = z.union([
  z.object({ pontos: z.array(leituraSchema).min(1).max(200) }).strict(),
  z
    .object({ latitude: leituraSchema.shape.latitude, longitude: leituraSchema.shape.longitude })
    .strict()
    .transform((l) => ({ pontos: [{ ...l, registradoEm: new Date() }] })),
]);

export async function localizacao(req: Request, res: Response, next: NextFunction) {
  try {
    const motoristaId = await getMotoristaId(req.usuario!.sub);
    const { pontos } = localizacaoSchema.parse(req.body);
    res.json(await localizacaoService.registrar(req.params.id, motoristaId, pontos));
  } catch (err) {
    next(err);
  }
}

export async function posicaoAtual(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await localizacaoService.posicaoAtual(req.params.id, req.usuario!));
  } catch (err) {
    next(err);
  }
}

export async function trajeto(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await localizacaoService.trajeto(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function aoVivo(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await localizacaoService.aoVivo());
  } catch (err) {
    next(err);
  }
}
