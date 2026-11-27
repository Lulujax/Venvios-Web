import ExcelJS from 'exceljs';

const MARCA = {
  marino: 'FF14286B',
  blanco: 'FFFFFFFF',
  papel: 'FFFAF8F3',
  linea: 'FFE6E0D2',
  texto: 'FF1F2937',
};

const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export type CeldaExcel = string | number | boolean | null | undefined;

function textoSeguro(valor: string): string {
  return INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
}

function normalizarCelda(valor: CeldaExcel): string | number {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : '';
  return textoSeguro(String(valor));
}

function anchoColumna(encabezado: string, filas: CeldaExcel[][], indice: number): number {
  const valores = [encabezado, ...filas.map((fila) => {
    const valor = fila[indice];
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    return String(valor);
  })];
  const maximo = valores.reduce((acc, valor) => Math.max(acc, valor.length), 10);
  return Math.min(Math.max(maximo + 2, 12), 42);
}

export async function aExcel(nombreHoja: string, encabezados: string[], filas: CeldaExcel[][]): Promise<Buffer> {
  if (encabezados.length === 0) throw new Error('El Excel necesita al menos una columna.');
  for (const fila of filas) {
    if (fila.length !== encabezados.length) throw new Error('Una fila del Excel no tiene el mismo número de columnas que el encabezado.');
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Venvios Express';
  libro.created = new Date();

  const hoja = libro.addWorksheet(nombreHoja.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  hoja.columns = encabezados.map((encabezado, indice) => ({
    header: encabezado,
    key: `c${indice}`,
    width: anchoColumna(encabezado, filas, indice),
  }));

  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.height = 24;
  filaEncabezado.eachCell((celda) => {
    celda.font = { name: 'Arial', bold: true, color: { argb: MARCA.blanco }, size: 11 };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA.marino } };
    celda.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    celda.border = {
      bottom: { style: 'thin', color: { argb: MARCA.marino } },
    };
  });

  filas.forEach((fila, indiceFila) => {
    const filaHoja = hoja.addRow(fila.map((valor) => normalizarCelda(valor)));
    filaHoja.height = 20;
    filaHoja.eachCell({ includeEmpty: true }, (celda) => {
      celda.font = { name: 'Arial', size: 10, color: { argb: MARCA.texto } };
      celda.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      celda.border = {
        bottom: { style: 'thin', color: { argb: MARCA.linea } },
      };
      if (indiceFila % 2 === 1) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA.papel } };
      }
    });
  });

  if (filas.length === 0) {
    const filaVacia = hoja.addRow(['Sin resultados para los filtros elegidos.']);
    hoja.mergeCells(2, 1, 2, encabezados.length);
    const celda = filaVacia.getCell(1);
    celda.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF5B6178' } };
    celda.alignment = { vertical: 'middle', horizontal: 'left' };
  }

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: encabezados.length },
  };

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function dineroExcel(centavos: number | null | undefined): string | number {
  if (centavos === null || centavos === undefined) return '';
  return Number((centavos / 100).toFixed(2));
}

export function fechaExcel(fecha: Date | string | null | undefined): string {
  if (!fecha) return '';
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) return '';
  return valor.toISOString().slice(0, 16).replace('T', ' ');
}
