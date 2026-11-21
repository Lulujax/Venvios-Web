import { describe, expect, it } from 'vitest';
import { codigoCortoEnvio, nombreEnvio } from '../src/lib/formato';

describe('nombre del envío', () => {
  it('caso feliz: un consolidado se llama Consolidación con 6 caracteres en mayúscula', () => {
    expect(nombreEnvio({ id: 'cmabc123def7k2m9q', tipo: 'CONSOLIDADO', tienda: 'Shein' })).toBe('Consolidación 7K2M9Q');
  });

  it('límite: un consolidado con paquetes de varias tiendas no usa la tienda', () => {
    expect(nombreEnvio({ id: 'xxxxxx000111', tipo: 'CONSOLIDADO', tienda: 'Shein, Amazon, AliExpress' })).toBe('Consolidación 000111');
  });

  it('una alerta conserva su tienda y los casos especiales su texto', () => {
    expect(nombreEnvio({ id: 'abcdef123456', tipo: 'ALERTA', tienda: 'Amazon' })).toBe('Amazon');
    expect(nombreEnvio({ id: 'abcdef123456', tipo: 'ALERTA', tienda: 'Sin prealerta' })).toBe('Paquete sin prealerta');
  });

  it('límite: un id corto se usa completo', () => {
    expect(codigoCortoEnvio('ab1')).toBe('AB1');
  });

  it('error: un id vacío falla con mensaje claro', () => {
    expect(() => codigoCortoEnvio('')).toThrow('no tiene un id');
  });
});
