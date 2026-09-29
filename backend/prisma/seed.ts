import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Dados de DEMONSTRAÇÃO (senha 123456): nunca em produção. O primeiro admin de
  // produção é criado com "npm run criar-admin".
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
    throw new Error("O seed de demonstração não roda em produção/staging. Use: npm run criar-admin");
  }
  console.log("Semeando banco de dados do Bus On...");

  const senhaHash = await bcrypt.hash("123456", 10);

  // Universidades
  const [facimp, ceuma, ifma] = await Promise.all([
    prisma.universidade.upsert({ where: { nome: "FACIMP" }, update: {}, create: { nome: "FACIMP" } }),
    prisma.universidade.upsert({ where: { nome: "CEUMA" }, update: {}, create: { nome: "CEUMA" } }),
    prisma.universidade.upsert({ where: { nome: "IFMA" }, update: {}, create: { nome: "IFMA" } }),
  ]);

  // Ônibus
  const onibus = await prisma.onibus.upsert({
    where: { placa: "BUS-0N23" },
    update: {},
    create: { placa: "BUS-0N23", capacidade: 30 },
  });

  // Admin
  await prisma.usuario.upsert({
    where: { email: "admin@buson.com" },
    update: {},
    create: { nome: "Administrador", email: "admin@buson.com", senhaHash, papel: "ADMIN" },
  });

  // Motorista
  const usuarioMotorista = await prisma.usuario.upsert({
    where: { email: "motorista@buson.com" },
    update: {},
    create: { nome: "Carlos Mendes", email: "motorista@buson.com", senhaHash, papel: "MOTORISTA" },
  });
  const motorista = await prisma.motorista.upsert({
    where: { usuarioId: usuarioMotorista.id },
    update: {},
    create: { usuarioId: usuarioMotorista.id, onibusId: onibus.id },
  });

  // Aluno de exemplo
  const usuarioAluno = await prisma.usuario.upsert({
    where: { email: "aluno@buson.com" },
    update: {},
    create: { nome: "Marina Alves", email: "aluno@buson.com", senhaHash, papel: "ALUNO" },
  });
  await prisma.aluno.upsert({
    where: { usuarioId: usuarioAluno.id },
    update: {},
    create: { usuarioId: usuarioAluno.id, universidadeId: facimp.id, statusConta: "ATIVO" },
  });

  // Rota com os 3 pontos (reaproveitada se o seed rodar de novo)
  const nomeRota = "Rota Universitária 01";
  const rota =
    (await prisma.rota.findFirst({ where: { nome: nomeRota } })) ??
    (await prisma.rota.create({
      data: {
        nome: nomeRota,
        pontos: {
          create: [
            { universidadeId: facimp.id, ordem: 1 },
            { universidadeId: ceuma.id, ordem: 2 },
            { universidadeId: ifma.id, ordem: 3 },
          ],
        },
      },
    }));

  // Viagem de hoje — o app só mostra as viagens do dia, então rode o seed de novo
  // em outro dia para ter uma viagem para testar
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setDate(fimDoDia.getDate() + 1);

  const viagemDeHoje = await prisma.viagem.findFirst({
    where: { motoristaId: motorista.id, rotaId: rota.id, data: { gte: inicioDoDia, lt: fimDoDia } },
  });
  if (!viagemDeHoje) {
    await prisma.viagem.create({
      data: {
        rotaId: rota.id,
        onibusId: onibus.id,
        motoristaId: motorista.id,
        data: new Date(),
        horario: "17:50",
        vagas: 30,
        status: "AGUARDANDO",
      },
    });
  }

  console.log("Concluído! Usuários de teste (senha para todos: 123456):");
  console.log("  admin@buson.com      (ADMIN)");
  console.log("  motorista@buson.com  (MOTORISTA)");
  console.log("  aluno@buson.com      (ALUNO)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
