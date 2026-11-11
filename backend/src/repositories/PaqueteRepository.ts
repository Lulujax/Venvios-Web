import { prisma } from '../lib/prisma';
import type { EstadoPaquete, Prisma } from '@prisma/client';

export interface NuevoPaqueteData {
  guia: string;
  descripcion: string;
  pesoKg: number;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  pesoVolumetrico: number | null;
  pesoCobrable: number;
  precio: number;
  observaciones?: string | null;
  userId: string;
  prealertaId?: string | null;
}

const SELECT_PUBLICO = {
  guia: true,
  estado: true,
  pesoCobrable: true,
  createdAt: true,
  updatedAt: true,
  eventos: {
    orderBy: { createdAt: 'asc' },
    select: { estado: true, nota: true, createdAt: true },
  },
} satisfies Prisma.PaqueteSelect;

const SELECT_ADMIN = {
  id: true,
  guia: true,
  descripcion: true,
  estado: true,
  pesoKg: true,
  pesoCobrable: true,
  precio: true,
  fotoUrl: true,
  createdAt: true,
  updatedAt: true,
  eventos: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { estado: true, nota: true, createdAt: true },
  },
  user: {
    select: {
      nombre: true,
      casillero: { select: { codigo: true } },
    },
  },
} satisfies Prisma.PaqueteSelect;

export class PaqueteRepository {
  async crear(data: NuevoPaqueteData) {
    return prisma.paquete.create({
      data: {
        guia: data.guia,
        descripcion: data.descripcion,
        pesoKg: data.pesoKg,
        largoCm: data.largoCm ?? null,
        anchoCm: data.anchoCm ?? null,
        altoCm: data.altoCm ?? null,
        pesoVolumetrico: data.pesoVolumetrico,
        pesoCobrable: data.pesoCobrable,
        precio: data.precio,
        observaciones: data.observaciones ?? null,
        userId: data.userId,
        prealertaId: data.prealertaId ?? null,
        eventos: {
          create: {
            estado: 'RECIBIDO',
            nota: 'Paquete recibido y pesado en la sede de Cúcuta.',
          },
        },
      },
      include: { eventos: true, user: { select: { nombre: true, casillero: true } } },
    });
  }

  async existeGuia(guia: string): Promise<boolean> {
    const count = await prisma.paquete.count({ where: { guia } });
    return count > 0;
  }

  async buscarPorGuia(guia: string) {
    return prisma.paquete.findUnique({
      where: { guia },
      include: {
        eventos: { orderBy: { createdAt: 'asc' } },
        user: { select: { nombre: true, casillero: true } },
      },
    });
  }

  async buscarPublicoPorGuia(guia: string) {
    return prisma.paquete.findUnique({
      where: { guia },
      select: SELECT_PUBLICO,
    });
  }

  async buscarPorId(id: string) {
    return prisma.paquete.findUnique({
      where: { id },
      include: {
        eventos: { orderBy: { createdAt: 'desc' } },
        user: { select: { nombre: true, casillero: true } },
      },
    });
  }

  async listarPorUsuario(userId: string) {
    return prisma.paquete.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        guia: true,
        descripcion: true,
        estado: true,
        pesoKg: true,
        pesoCobrable: true,
        precio: true,
        fotoUrl: true,
        createdAt: true,
        eventos: {
          orderBy: { createdAt: 'desc' },
          select: { estado: true, nota: true, createdAt: true },
        },
      },
    });
  }

  async listarAdmin(params: {
    estado?: EstadoPaquete;
    q?: string;
    pagina: number;
    porPagina: number;
  }) {
    const where: Prisma.PaqueteWhereInput = {};
    if (params.estado) where.estado = params.estado;
    if (params.q) {
      where.OR = [
        { guia: { contains: params.q, mode: 'insensitive' } },
        { descripcion: { contains: params.q, mode: 'insensitive' } },
        { user: { nombre: { contains: params.q, mode: 'insensitive' } } },
        { user: { casillero: { codigo: { contains: params.q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.paquete.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.pagina - 1) * params.porPagina,
        take: params.porPagina,
        select: SELECT_ADMIN,
      }),
      prisma.paquete.count({ where }),
    ]);

    return { items, total };
  }

  async actualizarEstado(id: string, estado: EstadoPaquete, nota: string) {
    await prisma.$transaction([
      prisma.paquete.update({ where: { id }, data: { estado } }),
      prisma.eventoPaquete.create({ data: { paqueteId: id, estado, nota } }),
    ]);
    return this.buscarPorId(id);
  }

  async actualizarFoto(id: string, fotoUrl: string) {
    return prisma.paquete.update({
      where: { id },
      data: { fotoUrl },
      select: { id: true, guia: true, fotoUrl: true },
    });
  }

  async contarTodos(): Promise<number> {
    return prisma.paquete.count();
  }

  async contarPorEstado() {
    return prisma.paquete.groupBy({
      by: ['estado'],
      _count: { _all: true },
    });
  }

  async sumarPreciosEntregados(): Promise<number> {
    const result = await prisma.paquete.aggregate({
      where: { estado: 'ENTREGADO' },
      _sum: { precio: true },
    });
    return result._sum.precio ?? 0;
  }

  async conteoPorEstado(estado: EstadoPaquete): Promise<number> {
    return prisma.paquete.count({ where: { estado } });
  }
}
