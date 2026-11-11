import { prisma } from '../lib/prisma';
import type { Rol } from '../entities';

export interface NuevoUsuarioData {
  nombre: string;
  email: string;
  telefono: string;
  passwordHash: string;
  rol: Rol;
}

export class UserRepository {
  async buscarPorEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { casillero: true },
    });
  }

  async buscarPorId(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { casillero: true },
    });
  }

  async existeEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { email } });
    return count > 0;
  }

  async crearConCasillero(data: NuevoUsuarioData, codigoCasillero: string) {
    return prisma.user.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        passwordHash: data.passwordHash,
        rol: data.rol,
        casillero: {
          create: { codigo: codigoCasillero },
        },
      },
      include: { casillero: true },
    });
  }

  async buscarClientePorCasillero(codigo: string) {
    return prisma.user.findFirst({
      where: {
        rol: 'CLIENTE',
        activo: true,
        casillero: { codigo },
      },
      select: {
        id: true,
        nombre: true,
        casillero: { select: { codigo: true, direccion: true } },
      },
    });
  }

  async contarClientes(): Promise<number> {
    return prisma.user.count({ where: { rol: 'CLIENTE' } });
  }
}
