import { describe, expect, it } from 'vitest';
import {
  TARIFAS_INICIALES,
  calcularPrecio,
  kilosACentesimas,
  modalidadPropuesta,
  sumarPesosCentesimas,
} from '../src/domain/tarifas';
import { dolaresABolivaresCentavos } from '../src/domain/dinero';

const peso = (kilos: number) => kilosACentesimas(kilos);

describe('modalidad 1', () => {
  it('caso feliz: 4,35 kg con 60 $ declarados cuesta 44,33 $', () => {
    const precio = calcularPrecio('M1', peso(4.35), 6000, TARIFAS_INICIALES);
    expect(precio.fleteCentavos).toBe(4133);
    expect(precio.seguroCentavos).toBe(300);
    expect(precio.totalCentavos).toBe(4433);
  });

  it('aplica el precio del tramo a todos los kilos', () => {
    expect(calcularPrecio('M1', peso(9.99), 0, TARIFAS_INICIALES).precioPorKgCentavos).toBe(950);
    expect(calcularPrecio('M1', peso(10), 0, TARIFAS_INICIALES).precioPorKgCentavos).toBe(850);
    expect(calcularPrecio('M1', peso(20), 0, TARIFAS_INICIALES).precioPorKgCentavos).toBe(750);
    expect(calcularPrecio('M1', peso(50), 0, TARIFAS_INICIALES).precioPorKgCentavos).toBe(650);
  });

  it('límite: 9,9 kg cuestan más que 10 kg (así lo define el flyer)', () => {
    const casiDiez = calcularPrecio('M1', peso(9.9), 0, TARIFAS_INICIALES).totalCentavos;
    const diez = calcularPrecio('M1', peso(10), 0, TARIFAS_INICIALES).totalCentavos;
    expect(casiDiez).toBe(9405);
    expect(diez).toBe(8500);
    expect(casiDiez).toBeGreaterThan(diez);
  });

  it('límite: un envío de 1 kg paga como 2 kg', () => {
    const precio = calcularPrecio('M1', peso(1), 0, TARIFAS_INICIALES);
    expect(precio.pesoCobrableCentesimas).toBe(200);
    expect(precio.totalCentavos).toBe(1900);
  });

  it('error: peso cero o negativo, valor declarado negativo', () => {
    expect(() => kilosACentesimas(0)).toThrow();
    expect(() => kilosACentesimas(-2)).toThrow();
    expect(() => calcularPrecio('M1', 0, 0, TARIFAS_INICIALES)).toThrow();
    expect(() => calcularPrecio('M1', 300, -1, TARIFAS_INICIALES)).toThrow('valor declarado');
  });

  it('error: configuración con tramos desordenados', () => {
    const rota = { ...TARIFAS_INICIALES, m1Tramos: [...TARIFAS_INICIALES.m1Tramos].reverse() };
    expect(() => calcularPrecio('M1', 500, 0, rota)).toThrow('ordenados');
  });
});

describe('modalidad 2', () => {
  it('caso feliz: 4,35 kg con 60 $ cuesta 27,90 $', () => {
    const precio = calcularPrecio('M2', peso(4.35), 6000, TARIFAS_INICIALES);
    expect(precio.fleteCentavos).toBe(2610);
    expect(precio.seguroCentavos).toBe(180);
    expect(precio.totalCentavos).toBe(2790);
  });

  it('límite: mínimo de 1 kg', () => {
    const precio = calcularPrecio('M2', peso(0.4), 0, TARIFAS_INICIALES);
    expect(precio.pesoCobrableCentesimas).toBe(100);
    expect(precio.totalCentavos).toBe(600);
  });

  it('error: valor declarado no entero', () => {
    expect(() => calcularPrecio('M2', 300, 10.5, TARIFAS_INICIALES)).toThrow();
  });
});

describe('elección de modalidad y suma de pesos', () => {
  it('propone M2 bajo 2 kg y M1 desde 2 kg', () => {
    expect(modalidadPropuesta(peso(1.99))).toBe('M2');
    expect(modalidadPropuesta(peso(2))).toBe('M1');
  });

  it('suma de paquetes con dos decimales exactos', () => {
    expect(sumarPesosCentesimas([2.4, 1.15, 0.8])).toBe(435);
  });

  it('error: sin paquetes o peso inválido', () => {
    expect(() => sumarPesosCentesimas([])).toThrow();
    expect(() => modalidadPropuesta(0)).toThrow();
  });
});

describe('bolívares', () => {
  it('convierte con la tasa BCV', () => {
    expect(dolaresABolivaresCentavos(4433, 917.7751)).toBe(Math.round(4433 * 917.7751));
  });

  it('límite: cero dólares son cero bolívares', () => {
    expect(dolaresABolivaresCentavos(0, 900)).toBe(0);
  });

  it('error: tasa cero, negativa o monto con decimales', () => {
    expect(() => dolaresABolivaresCentavos(100, 0)).toThrow('tasa');
    expect(() => dolaresABolivaresCentavos(100, -5)).toThrow();
    expect(() => dolaresABolivaresCentavos(10.5, 900)).toThrow();
  });
});
