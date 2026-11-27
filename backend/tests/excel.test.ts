import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { aExcel, dineroExcel, fechaExcel } from '../src/domain/excel';

async function leerHoja(buffer: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = libro.worksheets[0]!;
  const filas: unknown[][] = [];
  hoja.eachRow((fila) => {
    const valores: unknown[] = [];
    for (let i = 1; i <= hoja.columnCount; i += 1) valores.push(fila.getCell(i).value ?? '');
    filas.push(valores);
  });
  return { libro, hoja, filas };
}

describe('Excel para exportaciones (RF-152, RF-153)', () => {
  it('caso feliz: genera un xlsx con encabezado de marca, fila fija y filas con datos', async () => {
    const buffer = await aExcel('Prueba', ['Cliente', 'Total USD'], [['Ana Prueba', 43.25], ['José Núñez', 10]]);
    const { hoja, filas } = await leerHoja(buffer);
    expect(filas[0]).toEqual(['Cliente', 'Total USD']);
    expect(filas[1]).toEqual(['Ana Prueba', 43.25]);
    expect(filas[2]).toEqual(['José Núñez', 10]);
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(hoja.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(hoja.getRow(1).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FF14286B' } });
  });

  it('límite: escribe Sí/No, vacíos, números y protege texto que parece fórmula', async () => {
    const buffer = await aExcel('Prueba', ['A', 'B', 'C', 'D'], [[true, false, null, '=SUMA(1;2)'], [0, -5, undefined, '+57 300']]);
    const { filas } = await leerHoja(buffer);
    expect(filas[1]).toEqual(['Sí', 'No', '', "'=SUMA(1;2)"]);
    expect(filas[2]).toEqual([0, -5, '', "'+57 300"]);
  });

  it('límite: da el dinero como número con dos decimales y la fecha en UTC legible', () => {
    expect(dineroExcel(4325)).toBe(43.25);
    expect(dineroExcel(5)).toBe(0.05);
    expect(dineroExcel(null)).toBe('');
    expect(fechaExcel(new Date('2026-11-21T14:05:59Z'))).toBe('2026-11-21 14:05');
    expect(fechaExcel('no es fecha')).toBe('');
  });

  it('error: rechaza un Excel sin columnas o con una fila de otro largo', async () => {
    await expect(aExcel('Vacío', [], [])).rejects.toThrow(/al menos una columna/);
    await expect(aExcel('Malo', ['A', 'B'], [['solo una']])).rejects.toThrow(/mismo número de columnas/);
  });
});
