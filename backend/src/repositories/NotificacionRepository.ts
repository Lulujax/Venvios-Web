import { prisma } from '../lib/prisma';
import type { EstadoNotificacion } from '@prisma/client';

export interface NuevaNotificacionData {
  userId: string;
  paqueteId?: string | null;
  destinoEnmascarado: string;
  mensaje: string;
  estado: EstadoNotificacion;
  proveedorId?: string | null;
  error?: string | null;
}

export class NotificacionRepository {
  async crear(data: NuevaNotificacionData) {
    return prisma.notificacion.create({
      data: {
        userId: data.userId,
        paqueteId: data.paqueteId ?? null,
        destinoEnmascarado: data.destinoEnmascarado,
        mensaje: data.mensaje,
        estado: data.estado,
        proveedorId: data.proveedorId ?? null,
        error: data.error ?? null,
        canal: 'WHATSAPP',
      },
    });
  }

  async actualizarEstado(
    id: string,
    data: {
      estado: EstadoNotificacion;
      proveedorId?: string | null;
      error?: string | null;
    },
  ) {
    return prisma.notificacion.update({
      where: { id },
      data: {
        estado: data.estado,
        proveedorId: data.proveedorId ?? null,
        error: data.error ?? null,
      },
    });
  }

  async listarPorUsuario(userId: string) {
    return prisma.notificacion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        mensaje: true,
        canal: true,
        estado: true,
        destinoEnmascarado: true,
        createdAt: true,
      },
    });
  }
}
