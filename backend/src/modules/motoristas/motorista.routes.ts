import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, permitir } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { hashPassword } from "../../utils/password";

export const motoristaRouter = Router();

motoristaRouter.use(autenticar, permitir("ADMIN"));

const motoristaSelect = {
  id: true,
  onibusId: true,
  usuario: { select: { id: true, nome: true, email: true } },
  onibus: { select: { id: true, placa: true } },
} as const;

motoristaRouter.get("/", async (_req, res, next) => {
  try {
    const motoristas = await prisma.motorista.findMany({
      select: motoristaSelect,
      orderBy: { usuario: { nome: "asc" } },
    });
    res.json(motoristas);
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do motorista."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  onibusId: z.string().uuid().optional(),
});

motoristaRouter.post("/", async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const existente = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (existente) throw new AppError("Este e-mail já está cadastrado.", 409);

    const motorista = await prisma.motorista.create({
      data: {
        onibus: dados.onibusId ? { connect: { id: dados.onibusId } } : undefined,
        usuario: {
          create: { nome: dados.nome, email: dados.email, senhaHash: await hashPassword(dados.senha), papel: "MOTORISTA" },
        },
      },
      select: motoristaSelect,
    });
    res.status(201).json(motorista);
  } catch (err) {
    next(err);
  }
});

// Remove o usuário (o perfil de motorista cai em cascata). Falha se ele tiver viagens.
motoristaRouter.delete("/:id", async (req, res, next) => {
  try {
    const motorista = await prisma.motorista.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { viagens: true } } },
    });
    if (!motorista) throw new AppError("Motorista não encontrado.", 404);
    if (motorista._count.viagens > 0) {
      throw new AppError("Este motorista tem viagens cadastradas e não pode ser removido.", 409);
    }
    await prisma.usuario.delete({ where: { id: motorista.usuarioId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
