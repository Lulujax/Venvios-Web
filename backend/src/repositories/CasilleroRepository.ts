import { prisma } from '../lib/prisma';

export class CasilleroRepository {
  async existeCodigo(codigo: string): Promise<boolean> {
    const count = await prisma.casillero.count({ where: { codigo } });
    return count > 0;
  }

  async buscarPorUsuarioId(userId: string) {
    return prisma.casillero.findUnique({ where: { userId } });
  }

  async listar() {
    return prisma.casillero.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        codigo: true,
        ciudad: true,
        createdAt: true,
        user: { select: { nombre: true } },
      },
    });
  }
}
