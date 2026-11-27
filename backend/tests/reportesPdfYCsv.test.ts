import { inflateSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { describe, expect, it } from 'vitest';
import { armarEstadoDeCuenta, armarInventario, armarPrealertasPendientes, type ClienteReporte } from '../src/domain/reportes';
import { aExcelReporte } from '../src/domain/reportesExcel';
import { COLUMNAS_PDF, generarPdfReporte } from '../src/pdf/reportesPdf';

const AHORA = new Date('2026-11-27T12:00:00.000Z');
const ANA: ClienteReporte = { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' };

function decodificarStream(contenido: string): string {
  const lineas: string[] = [];
  for (const bloque of contenido.matchAll(/\[([^\]]+)\]\s*TJ/g)) {
    let texto = '';
    for (const hex of bloque[1]!.matchAll(/<([0-9a-fA-F]+)>/g)) {
      texto += Buffer.from(hex[1]!, 'hex').toString('latin1');
    }
    if (texto) lineas.push(texto);
  }
  return `${contenido}\n${lineas.join('\n')}`;
}

function textoDePdf(buffer: Buffer): string {
  const crudo = buffer.toString('latin1');
  const trozos = [crudo];
  for (const coincidencia of crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      trozos.push(decodificarStream(inflateSync(Buffer.from(coincidencia[1]!, 'latin1')).toString('latin1')));
    } catch {
      continue;
    }
  }
  return trozos.join('\n');
}

async function filasExcel(buffer: Buffer): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = libro.worksheets[0]!;
  const filas: string[][] = [];
  hoja.eachRow((fila) => {
    const valores: string[] = [];
    for (let i = 1; i <= hoja.columnCount; i += 1) {
      const valor = fila.getCell(i).value;
      valores.push(valor === null || valor === undefined ? '' : String(valor));
    }
    filas.push(valores);
  });
  return filas;
}

describe('PDF y Excel de los tres reportes (T-9, T-10)', () => {
  const inv = armarInventario(
    [
      {
        paqueteId: 'p1',
        tracking: 'INV-TRK-01',
        paqueteEstado: 'RECIBIDO',
        pesoKg: 2.5,
        recibidoEn: '2026-11-20T10:00:00.000Z',
        avisado: false,
        tieneFoto: true,
        envioId: 'e1',
        envioNumero: 1,
        envioTipo: 'ALERTA',
        envioEstado: 'RECIBIDO_COMPLETO',
        envioTienda: 'Shein',
        envioTransportista: 'MRW',
        envioCreadoEn: '2026-11-18T10:00:00.000Z',
        envioActualizadoEn: '2026-11-20T10:00:00.000Z',
        prealertaOrigen: { id: 'e1', tienda: 'Shein', fecha: '2026-11-18T10:00:00.000Z' },
        cliente: ANA,
      },
    ],
    { desde: '2026-11-01', hasta: '2026-11-27' },
    AHORA,
  );

  const pre = armarPrealertasPendientes(
    [
      {
        envioId: 'a1',
        tienda: 'Amazon',
        fechaAviso: '2026-11-21T10:00:00.000Z',
        cliente: ANA,
        paquetesDeOrigen: [
          { paqueteId: 'p1', tracking: 'AMZ-1', paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'DESPACHADO', sinDueno: false },
          { paqueteId: 'p2', tracking: 'AMZ-2', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
        ],
      },
    ],
    [],
    {},
    AHORA,
  );

  const cuenta = armarEstadoDeCuenta(
    ANA,
    [
      {
        envioId: 'a1',
        tienda: 'Amazon',
        fechaAviso: '2026-11-21T10:00:00.000Z',
        cliente: ANA,
        paquetesDeOrigen: [
          { paqueteId: 'p2', tracking: 'AMZ-2', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'PREALERTADO', sinDueno: false },
        ],
      },
    ],
    [],
    {},
    AHORA,
  );

  it('T-9: genera PDF válido de una hoja por tipo, incluye periodo/filtros y aviso de sin resultados cuando está vacío', async () => {
    for (const reporte of [inv, pre, cuenta]) {
      const pdf = await generarPdfReporte(reporte, 'Cliente: Ana Prueba');
      expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
      const texto = textoDePdf(pdf);
      expect(texto).toContain('/Count 1');
      expect(texto).not.toMatch(/c[eé]dula|tel[eé]fono|direcci[oó]n/i);
    }

    const pdfInv = textoDePdf(await generarPdfReporte(inv, 'Solo sin avisar'));
    expect(pdfInv).toContain('01/11/2026');
    expect(pdfInv).toContain('27/11/2026');
    expect(pdfInv).toContain('hora Cúcuta');
    expect(pdfInv).toContain('27/11/2026 07:00');
    expect(pdfInv).toContain('Solo sin avisar');

    const vacio = armarInventario([], {}, AHORA);
    const pdfVacio = textoDePdf(await generarPdfReporte(vacio, ''));
    expect(pdfVacio).toMatch(/sin resultados/i);
  });

  it('T-10: genera Excel de los tres tipos con una fila por paquete, formato legible y sin datos sensibles', async () => {
    const filasInv = await filasExcel(await aExcelReporte(inv));
    expect(filasInv).toHaveLength(2);
    expect(filasInv[0]).toContain('Tracking');
    expect(filasInv[0]).toContain('Etapa');
    expect(filasInv[0]).toContain('Prealerta origen');
    expect(filasInv[1]).toContain('INV-TRK-01');
    expect(filasInv[1]).toContain('En bodega');
    expect(filasInv[1]).toContain('Shein');
    expect(filasInv[0]?.join(';')).not.toMatch(/c[eé]dula|tel[eé]fono|direcci[oó]n/i);

    const filasPre = await filasExcel(await aExcelReporte(pre));
    expect(filasPre).toHaveLength(2);
    expect(filasPre[1]).toContain('Amazon');
    expect(filasPre[1]).toContain('1 de 2');
    expect(filasPre[1]).toContain('AMZ-2');

    const filasCuenta = await filasExcel(await aExcelReporte(cuenta));
    expect(filasCuenta).toHaveLength(2);
    expect(filasCuenta[1]).toContain('Por llegar');
    expect(filasCuenta[1]).toContain('AMZ-2');
  });
});

describe('Columnas del PDF sin recortes', () => {
  it('cada título de columna cabe completo en su ancho y cada tabla mide lo mismo', () => {
    const doc = new PDFDocument();
    doc.font('Helvetica-Bold').fontSize(8);
    for (const columnas of COLUMNAS_PDF) {
      expect(columnas.reduce((suma, c) => suma + c.ancho, 0)).toBe(515);
      for (const columna of columnas) {
        expect(doc.widthOfString(columna.titulo), `título cortado: ${columna.titulo}`).toBeLessThanOrEqual(columna.ancho - 8);
      }
    }
  });

  it('límite: un tracking muy largo no se recorta con puntos suspensivos', async () => {
    const reporte = armarInventario(
      [
        {
          paqueteId: 'p9',
          tracking: '9400111899223197428490123456',
          paqueteEstado: 'RECIBIDO',
          pesoKg: 125.75,
          recibidoEn: '2026-11-01T10:00:00.000Z',
          avisado: false,
          tieneFoto: false,
          envioId: 'e9',
          envioNumero: 9,
          envioTipo: 'ALERTA',
          envioEstado: 'RECIBIDO_COMPLETO',
          envioTienda: 'Shein',
          envioTransportista: 'MRW',
          envioCreadoEn: '2026-11-01T10:00:00.000Z',
          envioActualizadoEn: '2026-11-01T10:00:00.000Z',
          prealertaOrigen: { id: 'e9', tienda: 'Tienda con un nombre bastante largo', fecha: '2026-11-01T10:00:00.000Z' },
          cliente: ANA,
        },
      ],
      {},
      AHORA,
    );
    const texto = textoDePdf(await generarPdfReporte(reporte, ''));
    expect(texto.replace(/\r?\n/g, '')).toContain('9400111899223197428490123456');
    expect(texto).toContain('bastante');
  });
});
