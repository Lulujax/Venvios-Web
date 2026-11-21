import type { DestinoEntrega, EntregaGuardada, PerfilEntrega, Transportista, Usuario } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import type { CifradoCedula } from './cifrado';
import { limpiarTexto } from './validaciones';

export const TRANSPORTISTAS_PERFIL: Transportista[] = ['MRW', 'ZOOM'];

const MAX_CAMPO_DESTINO = 120;

export function destinoCompleto(destino: DestinoEntrega | undefined | null): destino is DestinoEntrega {
  return Boolean(destino && destino.agencia.trim() && destino.ciudad.trim() && destino.estado.trim());
}

export function limpiarDestino(entrada: unknown, transportista: Transportista): DestinoEntrega | null {
  if (entrada === null || entrada === undefined) return null;
  const crudo = entrada as Record<string, unknown>;
  const agencia = limpiarTexto(crudo.agencia, MAX_CAMPO_DESTINO);
  const ciudad = limpiarTexto(crudo.ciudad, MAX_CAMPO_DESTINO);
  const estado = limpiarTexto(crudo.estado, MAX_CAMPO_DESTINO);
  const llenos = [agencia, ciudad, estado].filter((valor) => valor.length > 0).length;
  if (llenos === 0) return null;
  if (llenos < 3) throw AppError.badRequest(`Completa la agencia, la ciudad y el estado de ${transportista}, o deja los tres vacíos.`);
  return { agencia, ciudad, estado };
}

export function entregaDesdePerfil(usuario: Usuario, transportista: Transportista, cifrado: CifradoCedula): EntregaGuardada | null {
  const perfil: PerfilEntrega | null = usuario.perfilEntrega;
  const destino = perfil?.destinos[transportista];
  if (!destinoCompleto(destino)) return null;
  const receptor = perfil?.receptor ?? null;
  return {
    nombreCifrado: receptor ? receptor.nombreCifrado : cifrado.cifrar(usuario.nombre),
    cedulaCifrada: receptor ? receptor.cedulaCifrada : usuario.cedulaCifrada,
    telefonoCifrado: receptor ? receptor.telefonoCifrado : cifrado.cifrar(usuario.telefono),
    agencia: destino.agencia,
    ciudad: destino.ciudad,
    estado: destino.estado,
  };
}
