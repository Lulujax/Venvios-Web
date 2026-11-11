import { prisma } from '../lib/prisma';
import type { EstadoPrealerta, Prisma } from '@prisma/client';

export interface NuevaPrealertaData {
  tienda: string;
  descripcion: string;
  trackingTienda?: string | null;
  valorDeclarado?: number | null;
  userId: string;
}

export class PrealertaRepository {
  async crear(data: NuevaPrealertaData) {
    return prisma.prealerta.create({
      data: {
        tienda: data.tienda,
        descripcion: data.descripcion,
        trackingTienda: data.trackingTienda ?? null,
        valorDeclarado: data.valorDeclarado ?? null,
        userId: data.userId,
      },
    });
  }

  async listarPorUsuario(userId: string) {
    return prisma.prealerta.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { paquete: { select: { guia: true, estado: true } } },
    });
  }

  async listarTodas(estado?: EstadoPrealerta) {
    return prisma.prealerta.findMany({
      where: estado ? { estado } : undefined,
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            casillero: { select: { codigo: true } },
          },
        },
        paquete: { select: { guia: true, estado: true } },
      },
    });
  }

  async buscarPorId(id: string) {
    return prisma.prealerta.findUnique({
      where: { id },
      include: { user: { include: { casillero: true } }, paquete: true },
    });
  }

  async marcarRecibida(id: string) {
    return prisma.prealerta.update({
      where: { id },
      data: { estado: 'RECIBIDA' },
    });
  }

  async contarPendientes(): Promise<number> {
    return prisma.prealerta.count({ where: { estado: 'PENDIENTE' } });
  }

  async contarPendientesPorUsuario(userId: string): Promise<number> {
    return prisma.prealerta.count({
      where: { userId, estado: 'PENDIENTE' },
    });
  }

  async listarPendientesConCliente(where: Prisma.PrealertaWhereInput) {
    return prisma.prealerta.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: { select: { nombre: true, casillero: { select: { codigo: true } } } },
      },
    });
  }
}
