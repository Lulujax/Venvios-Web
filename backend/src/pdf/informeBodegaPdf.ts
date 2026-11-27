import PDFDocument from 'pdfkit';
import type { ClienteInformeBodega, InformeBodega } from '../domain/informeBodega';

const MARGEN = 40;
const ALTO_BANDA = 92;
const ALTO_FILA = 18;
const DIAS_ALERTA = 15;

const COLOR = {
  marino: '#14286B',
  marino900: '#0C1A4A',
  marino50: '#F0F3FB',
  oro: '#F2B01E',
  papel: '#FAF8F3',
  linea: '#E6E0D2',
  suave: '#5B6178',
  rojo: '#B01C21',
  texto: '#1F2937',
  blanco: '#FFFFFF',
} as const;

const COLUMNAS = [
  { titulo: 'Tracking', ancho: 150 },
  { titulo: 'Peso (kg)', ancho: 50 },
  { titulo: 'Recibido', ancho: 95 },
  { titulo: 'Días', ancho: 35 },
  { titulo: 'Avisado', ancho: 50 },
  { titulo: 'Foto', ancho: 35 },
  { titulo: 'Tipo', ancho: 100 },
] as const;

function anchoDeTabla(): number {
  return COLUMNAS.reduce((suma, columna) => suma + columna.ancho, 0);
}

function formatearFechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const aa = String(fecha.getUTCFullYear()).slice(-2);
  const hh = String(fecha.getUTCHours()).padStart(2, '0');
  const mi = String(fecha.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aa} ${hh}:${mi}`;
}

function formatearFechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(fecha.getUTCHours()).padStart(2, '0');
  const mi = String(fecha.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getUTCFullYear()} ${hh}:${mi}`;
}

function formatearKg(kg: number | null): string {
  return kg === null ? '—' : `${kg.toFixed(2)} kg`;
}

function celda(doc: PDFKit.PDFDocument, texto: string, x: number, y: number, ancho: number) {
  doc.text(texto, x, y, { width: ancho - 6, height: 12, ellipsis: true, lineBreak: false });
}

function dibujarBandaMarca(doc: PDFKit.PDFDocument, informe: InformeBodega, filtrosTexto: string) {
  doc.rect(0, 0, doc.page.width, ALTO_BANDA).fill(COLOR.marino);
  doc.fillColor(COLOR.blanco).font('Helvetica-Bold').fontSize(20).text('Venvios Express', MARGEN, 20);
  doc.fillColor(COLOR.oro).font('Helvetica').fontSize(12).text('Informe de bodega', MARGEN, 46);
  const meta = filtrosTexto ? `Generado el ${formatearFechaLarga(informe.generadoEn)} · Filtros: ${filtrosTexto}` : `Generado el ${formatearFechaLarga(informe.generadoEn)}`;
  doc.fillColor('#C7CFE8').fontSize(8).text(meta, MARGEN, 66, { width: anchoDeTabla() });
  doc.x = MARGEN;
  doc.y = ALTO_BANDA + 20;
}

function dibujarResumen(doc: PDFKit.PDFDocument, informe: InformeBodega) {
  const { resumen } = informe;
  const tarjetas: Array<{ etiqueta: string; valor: string; acento?: boolean }> = [
    { etiqueta: 'Paquetes en bodega', valor: String(resumen.totalPaquetes) },
    { etiqueta: 'Peso total', valor: `${resumen.pesoTotalKg.toFixed(2)} kg` },
    { etiqueta: 'Sin dueño', valor: String(resumen.sinDueno) },
    { etiqueta: 'Sin avisar', valor: String(resumen.sinAvisar) },
  ];
  if (resumen.totalEnCamino > 0) tarjetas.push({ etiqueta: 'Por llegar', valor: String(resumen.totalEnCamino), acento: true });

  const gap = 10;
  const anchoTarjeta = (anchoDeTabla() - gap * (tarjetas.length - 1)) / tarjetas.length;
  const alto = 56;
  const y = doc.y;
  let x = MARGEN;
  for (const tarjeta of tarjetas) {
    doc.roundedRect(x, y, anchoTarjeta, alto, 6).fillAndStroke(COLOR.papel, COLOR.linea);
    doc.fillColor(COLOR.suave).font('Helvetica').fontSize(8).text(tarjeta.etiqueta, x + 10, y + 10, { width: anchoTarjeta - 20 });
    doc.fillColor(tarjeta.acento ? COLOR.oro : COLOR.marino).font('Helvetica-Bold').fontSize(18).text(tarjeta.valor, x + 10, y + 26, { width: anchoTarjeta - 20 });
    x += anchoTarjeta + gap;
  }
  doc.y = y + alto + 20;
  doc.x = MARGEN;
}

function dibujarEncabezadoTabla(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc.rect(MARGEN, y, anchoDeTabla(), ALTO_FILA).fill(COLOR.marino);
  let x = MARGEN;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR.blanco);
  for (const columna of COLUMNAS) {
    doc.text(columna.titulo, x + 5, y + 5, { width: columna.ancho - 10 });
    x += columna.ancho;
  }
  doc.font('Helvetica');
  doc.y = y + ALTO_FILA;
  doc.x = MARGEN;
}

function asegurarEspacio(doc: PDFKit.PDFDocument, alturaNecesaria: number, repetirEncabezado: () => void) {
  const limite = doc.page.height - doc.page.margins.bottom;
  if (doc.y + alturaNecesaria > limite) {
    doc.addPage();
    doc.fillColor(COLOR.suave).font('Helvetica').fontSize(8).text('Venvios Express · Informe de bodega (continuación)', MARGEN, MARGEN - 10);
    doc.y = MARGEN + 10;
    doc.x = MARGEN;
    repetirEncabezado();
  }
}

function dibujarCliente(doc: PDFKit.PDFDocument, grupo: ClienteInformeBodega) {
  asegurarEspacio(doc, 40 + ALTO_FILA, () => dibujarEncabezadoTabla(doc));

  const yBanda = doc.y;
  doc.roundedRect(MARGEN, yBanda, anchoDeTabla(), 30, 4).fill(COLOR.marino50);
  doc.fillColor(COLOR.marino).font('Helvetica-Bold').fontSize(11).text(grupo.cliente.nombre, MARGEN + 10, yBanda + 5, { width: anchoDeTabla() - 20, height: 14, ellipsis: true, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave);
  const codigo = grupo.cliente.codigo ? ` · ${grupo.cliente.codigo}` : '';
  const enCamino = grupo.totalEnCamino > 0 ? ` · ${grupo.totalEnCamino} por llegar` : '';
  doc.text(`${grupo.totalPaquetes} paquete(s)${codigo} · ${grupo.pesoTotalKg.toFixed(2)} kg${enCamino}`, MARGEN + 10, yBanda + 18, { width: anchoDeTabla() - 20, height: 10, ellipsis: true, lineBreak: false });
  doc.y = yBanda + 36;
  doc.x = MARGEN;

  dibujarEncabezadoTabla(doc);

  grupo.items.forEach((item, indice) => {
    asegurarEspacio(doc, ALTO_FILA, () => dibujarEncabezadoTabla(doc));
    const y = doc.y;
    if (indice % 2 === 1) doc.rect(MARGEN, y, anchoDeTabla(), ALTO_FILA).fill(COLOR.papel);

    let x = MARGEN;
    const celdas = [
      item.tracking,
      formatearKg(item.pesoKg),
      item.enCamino ? 'Esperado' : formatearFechaCorta(item.recibidoEn),
      item.diasEnBodega === null ? '—' : String(item.diasEnBodega),
      item.enCamino ? '—' : item.avisado ? 'Sí' : 'No',
      item.enCamino ? '—' : item.tieneFoto ? 'Sí' : 'No',
      item.tipoEnvio === 'CONSOLIDADO' ? 'Consolidado' : 'Alerta',
    ];
    const diasAlerta = !item.enCamino && item.diasEnBodega !== null && item.diasEnBodega >= DIAS_ALERTA;
    for (let i = 0; i < COLUMNAS.length; i++) {
      const esColumnaDias = COLUMNAS[i]!.titulo === 'Días';
      doc.font(esColumnaDias && diasAlerta ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      doc.fillColor(esColumnaDias && diasAlerta ? COLOR.rojo : item.enCamino ? COLOR.suave : COLOR.texto);
      celda(doc, celdas[i]!, x + 5, y + 4, COLUMNAS[i]!.ancho);
      x += COLUMNAS[i]!.ancho;
    }
    doc.y = y + ALTO_FILA;
    doc.x = MARGEN;
  });
  doc.y += 14;
}

function dibujarPiePagina(doc: PDFKit.PDFDocument) {
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 8;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + anchoDeTabla(), y).strokeColor(COLOR.oro).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(COLOR.suave).font('Helvetica').text(`Página ${i + 1} de ${rango.count} · Venvios Express`, MARGEN, y + 5, { width: anchoDeTabla(), align: 'center' });
  }
}

export function generarPdfInformeBodega(informe: InformeBodega, filtrosTexto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: 'A4', bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (trozo) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    dibujarBandaMarca(doc, informe, filtrosTexto);
    dibujarResumen(doc, informe);

    if (informe.clientes.length === 0) {
      doc.fontSize(11).fillColor(COLOR.suave).text('No hay paquetes que coincidan con los filtros pedidos.', MARGEN, doc.y);
    } else {
      for (const grupo of informe.clientes) dibujarCliente(doc, grupo);
    }

    dibujarPiePagina(doc);
    doc.end();
  });
}
