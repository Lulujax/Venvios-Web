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

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function diasEnBodega(iso: string | null, ahora: Date = new Date()): number | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / MS_POR_DIA));
}

export function textoAntiguedad(dias: number | null): string {
  if (dias === null) return 'Sin fecha';
  if (dias === 0) return 'Llegó hoy';
  return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
}

export function aNumero(texto: string): number {
  return Number(texto.replace(',', '.').trim());
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

export const TONO_ESTADO: Record<EstadoEnvio, string> = {
  PREALERTADO: 'bg-marino-100 text-marino',
  RECIBIDO_PARCIAL: 'bg-oro-100 text-oro-600',
  RECIBIDO_COMPLETO: 'bg-verde-100 text-verde',
  ARCHIVADO: 'bg-linea text-suave',
  POR_CONSOLIDAR: 'bg-marino-100 text-marino',
  POR_PAGAR: 'bg-oro text-marino-900',
  POR_CONFIRMAR: 'bg-oro-100 text-marino-900',
  PAGADO: 'bg-verde-100 text-verde',
  DESPACHADO: 'bg-marino text-white',
  CERRADO: 'bg-verde text-white',
  CANCELADO: 'bg-rojo-100 text-rojo-700',
};

export const PASOS_ENVIO: EstadoEnvio[] = ['POR_CONSOLIDAR', 'POR_PAGAR', 'POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO'];

export function pasoActual(estado: EstadoEnvio): number {
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

const LARGO_CODIGO_ENVIO = 6;

export function codigoCortoEnvio(id: string): string {
  const codigo = id.replace(/[^a-zA-Z0-9]/g, '').slice(-LARGO_CODIGO_ENVIO).toUpperCase();
  if (codigo.length === 0) throw new Error('El envío no tiene un id para sacar su código.');
  return codigo;
}

export function nombreEnvio(envio: { id: string; tipo: string; tienda: string }): string {
  if (envio.tipo === 'CONSOLIDADO') return `Consolidación ${codigoCortoEnvio(envio.id)}`;
  if (envio.tienda === 'Sin prealerta') return 'Paquete sin prealerta';
  if (envio.tienda === 'Devuelto a bodega') return 'Paquete en bodega';
  return envio.tienda;
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
