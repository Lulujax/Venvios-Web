import { describe, expect, it } from 'vitest';
import { ETIQUETAS_ESTADO, PASOS_ENVIO, TONO_ESTADO, pasoActual } from '../src/lib/formato';
import type { EstadoEnvio } from '../src/lib/tipos';

const TODOS: EstadoEnvio[] = [
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
];

describe('nombres cortos de estado en pantalla', () => {
  it('caso feliz: el recorrido del consolidado se lee con los nombres de la spec', () => {
    expect(PASOS_ENVIO.map((estado) => ETIQUETAS_ESTADO[estado])).toEqual([
      'Por consolidar',
      'Por pagar',
      'Pago en revisión',
      'Enviando a Venezuela',
      'En ruta',
      'Entregado',
    ]);
  });

  it('caso feliz: las alertas usan sus nombres', () => {
    expect(ETIQUETAS_ESTADO.PREALERTADO).toBe('Prealertado');
    expect(ETIQUETAS_ESTADO.RECIBIDO_PARCIAL).toBe('Recibido parcial');
    expect(ETIQUETAS_ESTADO.RECIBIDO_COMPLETO).toBe('En bodega');
  });

  it('límite: cada estado tiene etiqueta y color, y no hay etiquetas repetidas', () => {
    const etiquetas = TODOS.map((estado) => ETIQUETAS_ESTADO[estado]);
    expect(etiquetas.every((etiqueta) => etiqueta.trim().length > 0)).toBe(true);
    expect(new Set(etiquetas).size).toBe(TODOS.length);
    expect(TODOS.every((estado) => TONO_ESTADO[estado].length > 0)).toBe(true);
  });

  it('error: un estado de alerta no está dentro del recorrido del consolidado', () => {
    expect(pasoActual('PREALERTADO')).toBe(-1);
    expect(pasoActual('PAGADO')).toBe(3);
    expect(pasoActual('CERRADO')).toBe(PASOS_ENVIO.length - 1);
  });
});
