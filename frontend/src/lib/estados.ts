import type { EstadoPaquete, EstadoPrealerta } from '../types';

export const ETIQUETAS_ESTADO: Record<EstadoPaquete, string> = {
  RECIBIDO: 'Recibido',
  EN_BODEGA: 'En bodega',
  EN_TRANSITO: 'En tránsito',
  EN_ADUANA: 'En aduana',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const DESCRIPCION_ESTADO: Record<EstadoPaquete, string> = {
  RECIBIDO: 'Pesado y registrado en la sede de Cúcuta.',
  EN_BODEGA: 'Empacado y listo para el despacho.',
  EN_TRANSITO: 'En ruta hacia Venezuela.',
  EN_ADUANA: 'En proceso de cruce fronterizo.',
  ENTREGADO: 'Entregado al destinatario.',
  CANCELADO: 'Operación cerrada sin despacho.',
};

export const ETIQUETAS_PREALERTA: Record<EstadoPrealerta, string> = {
  PENDIENTE: 'Pendiente de recibir',
  RECIBIDA: 'Recibida en sede',
  CANCELADA: 'Cancelada',
};

export const ESTADOS_PAQUETE: EstadoPaquete[] = [
  'RECIBIDO',
  'EN_BODEGA',
  'EN_TRANSITO',
  'EN_ADUANA',
  'ENTREGADO',
  'CANCELADO',
];
