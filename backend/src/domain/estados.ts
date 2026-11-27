import { AppError } from '../utils/errors';

export const ESTADOS_ENVIO = [
  'PREALERTADO',
  'RECIBIDO_PARCIAL',
  'RECIBIDO_COMPLETO',
  'ARCHIVADO',
  'POR_CONSOLIDAR',
  'POR_PAGAR',
  'POR_CONFIRMAR',
  'PAGADO',
  'DESPACHADO',
  'CERRADO',
  'CANCELADO',
] as const;

export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export const TIPOS_ENVIO = ['ALERTA', 'CONSOLIDADO'] as const;
export type TipoEnvio = (typeof TIPOS_ENVIO)[number];

export const ESTADOS_ALERTA_ACTIVOS: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];
export const ESTADOS_CONSOLIDADO_ABIERTOS: EstadoEnvio[] = ['POR_CONSOLIDAR', 'POR_PAGAR'];
export const ESTADOS_COBRABLES: EstadoEnvio[] = ['POR_PAGAR', 'POR_CONFIRMAR'];
export const ESTADOS_FUERA_DE_BODEGA: EstadoEnvio[] = ['DESPACHADO', 'CERRADO', 'CANCELADO', 'ARCHIVADO'];

export const TIENDA_SIN_PREALERTA = 'Sin prealerta';
export const TIENDA_DEVUELTO = 'Devuelto a bodega';
export const TIENDAS_INTERNAS_BODEGA = [TIENDA_SIN_PREALERTA, TIENDA_DEVUELTO] as const;

export function esPrealertaReal(envio: { tipo: TipoEnvio; tienda: string; estado?: EstadoEnvio }): boolean {
  return envio.tipo === 'ALERTA' && !(TIENDAS_INTERNAS_BODEGA as readonly string[]).includes(envio.tienda) && envio.estado !== 'CANCELADO';
}

export const ETIQUETAS_ESTADO: Record<EstadoEnvio, string> = {
  PREALERTADO: 'Prealertado',
  RECIBIDO_PARCIAL: 'Recibido parcial',
  RECIBIDO_COMPLETO: 'En bodega',
  ARCHIVADO: 'Archivado',
  POR_CONSOLIDAR: 'Por consolidar',
  POR_PAGAR: 'Por pagar',
  POR_CONFIRMAR: 'Pago en revisión',
  PAGADO: 'Enviando a Venezuela',
  DESPACHADO: 'En ruta',
  CERRADO: 'Entregado',
  CANCELADO: 'Descartado',
};

export const TRANSICIONES: Record<EstadoEnvio, EstadoEnvio[]> = {
  PREALERTADO: ['RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO', 'ARCHIVADO', 'CANCELADO'],
  RECIBIDO_PARCIAL: ['PREALERTADO', 'RECIBIDO_COMPLETO', 'ARCHIVADO', 'CANCELADO'],
  RECIBIDO_COMPLETO: ['PREALERTADO', 'RECIBIDO_PARCIAL', 'ARCHIVADO', 'CANCELADO'],
  ARCHIVADO: [],
  POR_CONSOLIDAR: ['POR_PAGAR', 'CANCELADO'],
  POR_PAGAR: ['POR_CONSOLIDAR', 'POR_CONFIRMAR', 'PAGADO', 'CANCELADO'],
  POR_CONFIRMAR: ['PAGADO', 'POR_PAGAR'],
  PAGADO: ['DESPACHADO'],
  DESPACHADO: ['CERRADO'],
  CERRADO: [],
  CANCELADO: [],
};

export function validarTransicion(actual: EstadoEnvio, nuevo: EstadoEnvio): void {
  if (!ESTADOS_ENVIO.includes(actual) || !ESTADOS_ENVIO.includes(nuevo)) {
    throw AppError.badRequest('Estado desconocido.');
  }
  if (!TRANSICIONES[actual].includes(nuevo)) {
    throw AppError.badRequest(
      `No se puede pasar de "${ETIQUETAS_ESTADO[actual]}" a "${ETIQUETAS_ESTADO[nuevo]}".`,
      'TRANSICION_INVALIDA',
    );
  }
}

export function estadoDeAlerta(paquetes: Array<{ estado: 'ESPERADO' | 'RECIBIDO' }>): EstadoEnvio {
  if (paquetes.length === 0) return 'ARCHIVADO';
  const recibidos = paquetes.filter((paquete) => paquete.estado === 'RECIBIDO').length;
  if (recibidos === paquetes.length) return 'RECIBIDO_COMPLETO';
  return recibidos > 0 ? 'RECIBIDO_PARCIAL' : 'PREALERTADO';
}

export interface DatosEntrega {
  nombre?: string | null;
  cedula?: string | null;
  telefono?: string | null;
  agencia?: string | null;
  ciudad?: string | null;
  estado?: string | null;
}

export const CAMPOS_ENTREGA: Array<keyof DatosEntrega> = ['nombre', 'cedula', 'telefono', 'agencia', 'ciudad', 'estado'];

export function camposEntregaFaltantes(datos: DatosEntrega | null | undefined): string[] {
  return CAMPOS_ENTREGA.filter((campo) => !datos || !String(datos[campo] ?? '').trim());
}

export interface ContextoDespacho {
  estado: EstadoEnvio;
  pagoConfirmado: boolean;
  entrega: DatosEntrega | null | undefined;
}

export function faltantesParaDespachar(contexto: ContextoDespacho): string[] {
  const faltantes: string[] = [];
  if (!contexto.pagoConfirmado) faltantes.push('pago confirmado');
  for (const campo of camposEntregaFaltantes(contexto.entrega)) faltantes.push(`dato de entrega: ${campo}`);
  return faltantes;
}

export function validarDespacho(contexto: ContextoDespacho): void {
  if (contexto.estado !== 'PAGADO') {
    throw AppError.badRequest('Solo se puede despachar un envío pagado.', 'DESPACHO_SIN_PAGO');
  }
  const faltantes = faltantesParaDespachar(contexto);
  if (faltantes.length > 0) {
    throw AppError.badRequest(`Faltan datos para despachar: ${faltantes.join(', ')}.`, 'DESPACHO_INCOMPLETO');
  }
}
