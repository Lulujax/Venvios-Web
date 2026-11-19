import type { EstadoEnvio, Modalidad } from './tipos';

export function formatearUsd(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—';
  return `${(centavos / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function formatearBs(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—';
  return `${(centavos / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
}

export function formatearKg(kilos: number | null | undefined): string {
  if (kilos === null || kilos === undefined || !Number.isFinite(kilos)) return '—';
  return `${kilos.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function aNumero(texto: string): number {
  return Number(texto.replace(',', '.').trim());
}

export const ETIQUETAS_ESTADO: Record<EstadoEnvio, string> = {
  PREALERTADO: 'Esperando paquetes',
  RECIBIDO_PARCIAL: 'Llegada parcial',
  RECIBIDO_COMPLETO: 'Listo para pagar',
  POR_CONFIRMAR: 'Pago en revisión',
  PAGADO: 'Pagado',
  DESPACHADO: 'En camino a Venezuela',
  CERRADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const TONO_ESTADO: Record<EstadoEnvio, string> = {
  PREALERTADO: 'bg-marino-100 text-marino',
  RECIBIDO_PARCIAL: 'bg-oro-100 text-oro-600',
  RECIBIDO_COMPLETO: 'bg-oro text-marino-900',
  POR_CONFIRMAR: 'bg-oro-100 text-marino-900',
  PAGADO: 'bg-verde-100 text-verde',
  DESPACHADO: 'bg-marino text-white',
  CERRADO: 'bg-verde text-white',
  CANCELADO: 'bg-rojo-100 text-rojo-700',
};

export const PASOS_ENVIO: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_COMPLETO', 'POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO'];

export function pasoActual(estado: EstadoEnvio): number {
  if (estado === 'RECIBIDO_PARCIAL') return 0;
  if (estado === 'CANCELADO') return -1;
  return PASOS_ENVIO.indexOf(estado);
}

export const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  M1: 'Envío con todo incluido',
  M2: 'Cobro a destino',
};

export const DESCRIPCION_MODALIDAD: Record<Modalidad, string> = {
  M1: 'Pagas todo a Venvios y recibes sin sorpresas.',
  M2: 'Pagas a Venvios el flete y el seguro. El tramo en Venezuela lo pagas a MRW o Zoom al recibir.',
};

export function nombreTransportista(codigo: string): string {
  return codigo === 'ZOOM' ? 'Zoom' : codigo === 'MRW' ? 'MRW' : codigo;
}

export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export const NOMBRE_METODO: Record<string, string> = {
  BINANCE: 'Binance',
  PAGO_MOVIL: 'Pago móvil',
  TRANSFERENCIA: 'Transferencia',
  MANUAL: 'Registrado en oficina',
};
