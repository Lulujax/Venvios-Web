import PDFDocument from 'pdfkit';
import type { ClienteInformeBodega, InformeBodega } from '../domain/informeBodega';

const MARGEN = 40;
const COLUMNAS = [
  { titulo: 'Tracking', ancho: 140 },
  { titulo: 'Peso (kg)', ancho: 55 },
  { titulo: 'Recibido', ancho: 90 },
  { titulo: 'Días', ancho: 40 },
  { titulo: 'Avisado', ancho: 55 },
  { titulo: 'Foto', ancho: 40 },
  { titulo: 'Tipo', ancho: 95 },
] as const;

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-VE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatearKg(kg: number | null): string {
  return kg === null ? '—' : `${kg.toFixed(2)} kg`;
}

function anchoDeTabla(): number {
  return COLUMNAS.reduce((suma, columna) => suma + columna.ancho, 0);
}

function dibujarResumen(doc: PDFKit.PDFDocument, informe: InformeBodega) {
  const { resumen } = informe;
  doc.fontSize(11).fillColor('#1f2937');
  const filas = [
    ['Paquetes en bodega', String(resumen.totalPaquetes)],
    ['Peso total', `${resumen.pesoTotalKg.toFixed(2)} kg`],
    ['Sin dueño', String(resumen.sinDueno)],
    ['Sin avisar', String(resumen.sinAvisar)],
  ];
  if (resumen.totalEnCamino > 0) filas.push(['Por llegar (esperados)', String(resumen.totalEnCamino)]);

  const inicioY = doc.y;
  doc.save();
  doc.roundedRect(MARGEN, inicioY, anchoDeTabla(), 20 + filas.length * 16, 6).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.restore();
  doc.fillColor('#1f2937').fontSize(10).text('Resumen', MARGEN + 12, inicioY + 10, { underline: true });
  let y = inicioY + 28;
  for (const [etiqueta, valor] of filas) {
    doc.fontSize(10).fillColor('#374151').text(etiqueta, MARGEN + 12, y, { width: anchoDeTabla() / 2 });
    doc.font('Helvetica-Bold').text(valor, MARGEN + anchoDeTabla() / 2, y, { width: anchoDeTabla() / 2 - 12 });
    doc.font('Helvetica');
    y += 16;
  }
  doc.y = y + 10;
}

function dibujarEncabezadoTabla(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827');
  let x = MARGEN;
  for (const columna of COLUMNAS) {
    doc.text(columna.titulo, x, y, { width: columna.ancho });
    x += columna.ancho;
  }
  doc.font('Helvetica');
  doc.moveTo(MARGEN, y + 14).lineTo(MARGEN + anchoDeTabla(), y + 14).strokeColor('#d1d5db').stroke();
  doc.y = y + 20;
}

function asegurarEspacio(doc: PDFKit.PDFDocument, alturaNecesaria: number) {
  const limite = doc.page.height - doc.page.margins.bottom;
  if (doc.y + alturaNecesaria > limite) {
    doc.addPage();
    dibujarEncabezadoTabla(doc);
  }
}

function dibujarCliente(doc: PDFKit.PDFDocument, grupo: ClienteInformeBodega) {
  asegurarEspacio(doc, 40);
  doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(grupo.cliente.nombre, MARGEN, doc.y);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  const codigo = grupo.cliente.codigo ? ` · ${grupo.cliente.codigo}` : '';
  const enCamino = grupo.totalEnCamino > 0 ? ` · ${grupo.totalEnCamino} por llegar` : '';
  doc.text(`${grupo.totalPaquetes} paquete(s)${codigo} · ${grupo.pesoTotalKg.toFixed(2)} kg${enCamino}`, MARGEN, doc.y);
  doc.moveDown(0.4);
  dibujarEncabezadoTabla(doc);

  for (const item of grupo.items) {
    asegurarEspacio(doc, 16);
    const y = doc.y;
    let x = MARGEN;
    doc.fontSize(9).fillColor('#1f2937');
    const celdas = [
      item.tracking,
      formatearKg(item.pesoKg),
      item.enCamino ? 'Esperado' : formatearFecha(item.recibidoEn),
      item.diasEnBodega === null ? '—' : String(item.diasEnBodega),
      item.enCamino ? '—' : item.avisado ? 'Sí' : 'No',
      item.enCamino ? '—' : item.tieneFoto ? 'Sí' : 'No',
      item.tipoEnvio === 'CONSOLIDADO' ? 'Consolidado' : 'Alerta',
    ];
    for (let i = 0; i < COLUMNAS.length; i++) {
      doc.text(celdas[i]!, x, y, { width: COLUMNAS[i]!.ancho });
      x += COLUMNAS[i]!.ancho;
    }
    doc.y = y + 16;
  }
  doc.moveDown(0.6);
}

function dibujarPiePagina(doc: PDFKit.PDFDocument) {
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 10;
    doc.fontSize(8).fillColor('#9ca3af').text(`Página ${i + 1} de ${rango.count} · Venvios Express`, MARGEN, y, { width: anchoDeTabla(), align: 'center' });
  }
}

export function generarPdfInformeBodega(informe: InformeBodega, filtrosTexto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: 'A4', bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (trozo) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#111827').font('Helvetica-Bold').text('Venvios Express');
    doc.font('Helvetica').fontSize(13).fillColor('#374151').text('Informe de bodega');
    doc.fontSize(9).fillColor('#9ca3af').text(`Generado el ${formatearFecha(informe.generadoEn)}`);
    if (filtrosTexto) doc.text(`Filtros aplicados: ${filtrosTexto}`);
    doc.moveDown(0.8);

    dibujarResumen(doc, informe);
    doc.moveDown(0.5);

    if (informe.clientes.length === 0) {
      doc.fontSize(11).fillColor('#374151').text('No hay paquetes que coincidan con los filtros pedidos.');
    } else {
      for (const grupo of informe.clientes) dibujarCliente(doc, grupo);
    }

    dibujarPiePagina(doc);
    doc.end();
  });
}
