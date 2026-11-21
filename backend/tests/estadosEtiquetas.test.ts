import { describe, expect, it } from 'vitest';
import { PLANTILLAS_INICIALES } from '../src/config/predeterminados';
import { ESTADOS_ENVIO, ETIQUETAS_ESTADO, validarTransicion, type EstadoEnvio } from '../src/domain/estados';
import { renderizarPlantilla } from '../src/domain/whatsapp';

const RECORRIDO_CONSOLIDADO: EstadoEnvio[] = ['POR_CONSOLIDAR', 'POR_PAGAR', 'POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO'];

describe('nombres cortos de estado', () => {
  it('caso feliz: el recorrido del consolidado usa los nombres de la spec', () => {
    expect(RECORRIDO_CONSOLIDADO.map((estado) => ETIQUETAS_ESTADO[estado])).toEqual([
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
    expect(ETIQUETAS_ESTADO.ARCHIVADO).toBe('Archivado');
    expect(ETIQUETAS_ESTADO.CANCELADO).toBe('Descartado');
  });

  it('límite: los 11 estados tienen una etiqueta, ninguna vacía ni repetida', () => {
    const etiquetas = ESTADOS_ENVIO.map((estado) => ETIQUETAS_ESTADO[estado]);
    expect(etiquetas).toHaveLength(11);
    expect(etiquetas.every((etiqueta) => etiqueta.trim().length > 0)).toBe(true);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });

  it('error: una transición inválida avisa con los nombres nuevos', () => {
    expect(() => validarTransicion('PAGADO', 'CERRADO')).toThrow('No se puede pasar de "Enviando a Venezuela" a "Entregado".');
  });
});

describe('plantilla de pago verificado', () => {
  const variables = { nombre: 'Ana', nota_modalidad: '', enlace_cuenta: 'https://prueba.venvios.test/cuenta/envios/abc' };

  it('caso feliz: avisa que el envío sale hacia Venezuela y enlaza la cuenta', () => {
    const texto = renderizarPlantilla(PLANTILLAS_INICIALES.pagoVerificado, variables);
    expect(texto).toContain('Tu pago fue verificado');
    expect(texto).toContain('Hola Ana');
    expect(texto).toContain('sale hacia Venezuela');
    expect(texto).toContain('https://prueba.venvios.test/cuenta/envios/abc');
  });

  it('límite: ya no pide cédula, teléfono ni agencia y no deja variables sin reemplazar', () => {
    const texto = renderizarPlantilla(PLANTILLAS_INICIALES.pagoVerificado, variables);
    expect(texto).not.toMatch(/C\.I\.|teléfono|agencia|Agencia/);
    expect(texto).not.toContain('{');
  });

  it('límite: con cobro a destino agrega la nota de la transportista', () => {
    const nota = 'Recuerda: el envío dentro de Venezuela lo pagas tú directamente a MRW cuando lo recibas (cobro a destino).';
    expect(renderizarPlantilla(PLANTILLAS_INICIALES.pagoVerificado, { ...variables, nota_modalidad: nota })).toContain(nota);
  });

  it('error: una plantilla vacía no se puede generar', () => {
    expect(() => renderizarPlantilla('', variables)).toThrow();
  });
});
