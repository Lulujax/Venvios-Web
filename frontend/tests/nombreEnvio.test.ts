import { describe, expect, it } from 'vitest';
import { nombreEnvio, numeroConsolidacion } from '../src/lib/formato';

describe('nombre del envío', () => {
  it('caso feliz: un consolidado se llama Consolidación con 6 cifras', () => {
    expect(nombreEnvio({ numero: 123, tipo: 'CONSOLIDADO', tienda: 'Shein' })).toBe('Consolidación 000123');
  });

  it('límite: un consolidado con paquetes de varias tiendas no usa la tienda, y un número largo no se corta', () => {
    expect(nombreEnvio({ numero: 1234567, tipo: 'CONSOLIDADO', tienda: 'Shein, Amazon' })).toBe('Consolidación 1234567');
  });

  it('una alerta conserva su tienda y los casos especiales su texto', () => {
    expect(nombreEnvio({ numero: 5, tipo: 'ALERTA', tienda: 'Amazon' })).toBe('Amazon');
    expect(nombreEnvio({ numero: 5, tipo: 'ALERTA', tienda: 'Sin prealerta' })).toBe('Paquete sin prealerta');
  });

  it('error: un número inválido falla con mensaje claro', () => {
    expect(() => numeroConsolidacion(0)).toThrow('número válido');
    expect(() => numeroConsolidacion(1.5)).toThrow('número válido');
  });
});
