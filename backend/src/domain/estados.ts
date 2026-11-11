import type { SignOptions } from 'jsonwebtoken';

export const ESTADOS_PAQUETE = [
  'RECIBIDO',
  'EN_BODEGA',
  'EN_TRANSITO',
  'EN_ADUANA',
  'ENTREGADO',
  'CANCELADO',
] as const;

export type EstadoPaqueteValue = (typeof ESTADOS_PAQUETE)[number];

/**
 * Transiciones válidas del manifiesto. Un paquete no puede retroceder ni
 * saltarse la aduana. CANCELADO solo aplica antes de salir de Cúcuta.
 */
export const TRANSICIONES: Record<EstadoPaqueteValue, EstadoPaqueteValue[]> = {
  RECIBIDO: ['EN_BODEGA', 'CANCELADO'],
  EN_BODEGA: ['EN_TRANSITO', 'CANCELADO'],
  EN_TRANSITO: ['EN_ADUANA', 'ENTREGADO'],
  EN_ADUANA: ['EN_TRANSITO', 'ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export const ETIQUETAS_ESTADO: Record<EstadoPaqueteValue, string> = {
  RECIBIDO: 'Recibido en Cúcuta',
  EN_BODEGA: 'En bodega',
  EN_TRANSITO: 'En tránsito a Venezuela',
  EN_ADUANA: 'En aduana',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const JWT_EXPIRES: SignOptions['expiresIn'] = '7d';
