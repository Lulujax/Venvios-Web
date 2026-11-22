import { describe, expect, it } from 'vitest';
import { aCsv, celdaCsv, dineroCsv, fechaCsv } from '../src/domain/csv';

describe('CSV para Excel (RF-152, RF-153)', () => {
  it('caso feliz: separa con punto y coma, usa saltos de línea de Windows y empieza con la marca UTF-8', () => {
    const csv = aCsv(['Cliente', 'Total USD'], [['Ana Prueba', '43,25'], ['José Núñez', '10,00']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1)).toBe('Cliente;Total USD\r\nAna Prueba;43,25\r\nJosé Núñez;10,00\r\n');
  });

  it('límite: cita las celdas con punto y coma, comillas o saltos de línea, y escribe Sí/No, vacío y números', () => {
    expect(celdaCsv('a;b')).toBe('"a;b"');
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""');
    expect(celdaCsv('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
    expect(celdaCsv(true)).toBe('Sí');
    expect(celdaCsv(false)).toBe('No');
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv(undefined)).toBe('');
    expect(celdaCsv(0)).toBe('0');
    expect(celdaCsv(-5)).toBe('-5');
  });

  it('límite: protege las celdas de texto que Excel ejecutaría como fórmula', () => {
    expect(celdaCsv('=SUMA(1;2)')).toBe('"\'=SUMA(1;2)"');
    expect(celdaCsv('+57 300 1234567')).toBe("'+57 300 1234567");
    expect(celdaCsv('-cmd')).toBe("'-cmd");
    expect(celdaCsv('@usuario')).toBe("'@usuario");
    expect(celdaCsv('Cliente normal')).toBe('Cliente normal');
  });

  it('límite: da el dinero con coma decimal y la fecha en UTC, y deja vacío lo que no existe', () => {
    expect(dineroCsv(4325)).toBe('43,25');
    expect(dineroCsv(5)).toBe('0,05');
    expect(dineroCsv(null)).toBe('');
    expect(fechaCsv(new Date('2026-11-21T14:05:59Z'))).toBe('2026-11-21 14:05');
    expect(fechaCsv('no es fecha')).toBe('');
    expect(fechaCsv(null)).toBe('');
  });

  it('error: rechaza un CSV sin columnas o con una fila de otro largo', () => {
    expect(() => aCsv([], [])).toThrow(/al menos una columna/);
    expect(() => aCsv(['A', 'B'], [['solo una']])).toThrow(/mismo número de columnas/);
  });
});
