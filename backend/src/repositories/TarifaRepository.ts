import { prisma } from '../lib/prisma';

export class TarifaRepository {
  async listarActivas() {
    return prisma.tarifa.findMany({
      where: { activo: true },
      orderBy: { pesoHasta: 'asc' },
    });
  }

  async listarTodas() {
    return prisma.tarifa.findMany({ orderBy: { pesoHasta: 'asc' } });
  }
}
