import PDFDocument from 'pdfkit';
import type {
  ConsolidadoEstadoCuenta,
  OrigenPaqueteEstado,
  PrealertaOrigenVista,
  PrealertaPendienteVista,
  ReporteEstadoCuenta,
  ReporteGenerado,
  ReporteInventario,
  ReportePrealertasPendientes,
} from '../domain/reportes';

const MARGEN = 40;
const ALTO_BANDA = 94;
const ALTO_FILA = 18;
const ANCHO_TABLA = 515;
const DIAS_ALERTA = 15;
const ZONA_HORARIA_CUCUTA = 'America/Bogota';

const FORMATO_CUCUTA = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA_CUCUTA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const COLOR = {
  marino: '#14286B',
  marino50: '#F0F3FB',
  oro: '#F2B01E',
  papel: '#FAF8F3',
  linea: '#E6E0D2',
  suave: '#5B6178',
  rojo: '#B01C21',
  texto: '#1F2937',
  blanco: '#FFFFFF',
} as const;

interface Columna {
  titulo: string;
  ancho: number;
}

interface Tarjeta {
  etiqueta: string;
  valor: string;
  acento?: boolean;
}

const TITULO_REPORTE: Record<ReporteGenerado['tipo'], string> = {
  inventario: 'Inventario de bodega',
  'prealertas-pendientes': 'Prealertas pendientes',
  'estado-de-cuenta': 'Estado de cuenta de cliente',
};

const COLUMNAS_INVENTARIO: Columna[] = [
  { titulo: 'Tracking', ancho: 108 },
  { titulo: 'Etapa', ancho: 68 },
  { titulo: 'Prealerta origen', ancho: 112 },
  { titulo: 'Peso', ancho: 48 },
  { titulo: 'Recibido', ancho: 68 },
  { titulo: 'Días', ancho: 32 },
  { titulo: 'Avisado', ancho: 48 },
  { titulo: 'Foto', ancho: 31 },
];

const COLUMNAS_PREALERTAS: Columna[] = [
  { titulo: 'Tienda', ancho: 95 },
  { titulo: 'Fecha aviso', ancho: 78 },
  { titulo: 'Días aviso', ancho: 52 },
  { titulo: 'Llegaron', ancho: 68 },
  { titulo: 'Trackings que faltan', ancho: 222 },
];

const COLUMNAS_BODEGA_CLIENTE: Columna[] = [
  { titulo: 'Tracking', ancho: 128 },
  { titulo: 'Prealerta origen', ancho: 150 },
  { titulo: 'Peso', ancho: 52 },
  { titulo: 'Recibido', ancho: 72 },
  { titulo: 'Días', ancho: 32 },
  { titulo: 'Avisado', ancho: 48 },
  { titulo: 'Foto', ancho: 33 },
];

const COLUMNAS_CONSOLIDADO_CLIENTE: Columna[] = [
  { titulo: 'Tracking', ancho: 122 },
  { titulo: 'Prealerta origen', ancho: 175 },
  { titulo: 'Peso', ancho: 62 },
  { titulo: 'Recibido', ancho: 98 },
  { titulo: 'En bodega', ancho: 58 },
];

export const COLUMNAS_PDF = [COLUMNAS_INVENTARIO, COLUMNAS_PREALERTAS, COLUMNAS_BODEGA_CLIENTE, COLUMNAS_CONSOLIDADO_CLIENTE];

function partesCucuta(iso: string | null): { dd: string; mm: string; yyyy: string; yy: string; hh: string; mi: string } | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = FORMATO_CUCUTA.formatToParts(fecha);
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  const yyyy = obtener('year');
  return {
    dd: obtener('day'),
    mm: obtener('month'),
    yyyy,
    yy: yyyy.slice(-2),
    hh: obtener('hour'),
    mi: obtener('minute'),
  };
}

function formatearFechaCorta(iso: string | null): string {
  const p = partesCucuta(iso);
  return p ? `${p.dd}/${p.mm}/${p.yy} ${p.hh}:${p.mi}` : '—';
}

function formatearSoloFecha(iso: string | null): string {
  const p = partesCucuta(iso);
  return p ? `${p.dd}/${p.mm}/${p.yy}` : '—';
}

function formatearFechaLarga(iso: string): string {
  const p = partesCucuta(iso);
  return p ? `${p.dd}/${p.mm}/${p.yyyy} ${p.hh}:${p.mi}` : '—';
}

function formatearFechaIso(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
}

function formatearKg(kg: number | null): string {
  return kg === null ? '—' : `${kg.toFixed(2)} kg`;
}

function formatearDias(dias: number | null): string {
  if (dias === null) return '—';
  return dias === 0 ? 'Hoy' : `${dias} d`;
}

function textoOrigenCorto(estado: OrigenPaqueteEstado, origen: PrealertaOrigenVista | null): string {
  if (estado === 'PREALERTA' && origen) return `${origen.tienda} · ${formatearSoloFecha(origen.fecha)}`;
  if (estado === 'SIN_PREALERTA') return 'Sin prealerta';
  return 'Sin prealerta registrada';
}

function textoPeriodo(periodo: { desde: string | null; hasta: string | null }): string {
  if (periodo.desde && periodo.hasta) return `Periodo: ${formatearFechaIso(periodo.desde)} a ${formatearFechaIso(periodo.hasta)}`;
  if (periodo.desde) return `Periodo: desde ${formatearFechaIso(periodo.desde)}`;
  if (periodo.hasta) return `Periodo: hasta ${formatearFechaIso(periodo.hasta)}`;
  return '';
}

function sumaPesosKg(items: Array<{ pesoKg: number | null }>): number | null {
  let hayAlguno = false;
  let total = 0;
  for (const item of items) {
    if (item.pesoKg !== null) {
      hayAlguno = true;
      total += item.pesoKg;
    }
  }
  return hayAlguno ? Math.round(total * 100) / 100 : null;
}

interface EstiloCelda {
  fuente: 'Helvetica' | 'Helvetica-Bold';
  color: string;
}

const ESTILO_NORMAL: EstiloCelda = { fuente: 'Helvetica', color: COLOR.texto };

function dibujarFilas<T>(
  doc: PDFKit.PDFDocument,
  columnas: Columna[],
  items: T[],
  tituloPagina: string,
  celdasDe: (item: T) => string[],
  estiloDe: (item: T, columna: number) => EstiloCelda = () => ESTILO_NORMAL,
) {
  items.forEach((item, indice) => {
    const celdas = celdasDe(item);
    const altos = celdas.map((texto, i) => doc.font(estiloDe(item, i).fuente).fontSize(8).heightOfString(texto, { width: columnas[i]!.ancho - 8 }));
    const altoFila = Math.max(ALTO_FILA, Math.ceil(Math.max(...altos)) + 8);
    asegurarEspacio(doc, altoFila, tituloPagina, () => dibujarEncabezadoTabla(doc, columnas));
    const y = doc.y;
    if (indice % 2 === 1) doc.rect(MARGEN, y, ANCHO_TABLA, altoFila).fill(COLOR.papel);
    let x = MARGEN;
    celdas.forEach((texto, i) => {
      const estilo = estiloDe(item, i);
      doc.font(estilo.fuente).fontSize(8).fillColor(estilo.color).text(texto, x + 4, y + 4, { width: columnas[i]!.ancho - 8 });
      x += columnas[i]!.ancho;
    });
    doc.y = y + altoFila;
    doc.x = MARGEN;
  });
}

function dibujarBandaMarca(doc: PDFKit.PDFDocument, reporte: ReporteGenerado, filtrosTexto: string) {
  doc.rect(0, 0, doc.page.width, ALTO_BANDA).fill(COLOR.marino);
  doc.fillColor(COLOR.blanco).font('Helvetica-Bold').fontSize(20).text('Venvios Express', MARGEN, 18);
  doc.fillColor(COLOR.oro).font('Helvetica').fontSize(12).text(TITULO_REPORTE[reporte.tipo], MARGEN, 44);
  const partes = [`Generado el ${formatearFechaLarga(reporte.generadoEn)} (hora Cúcuta)`];
  const periodo = textoPeriodo(reporte.periodo);
  if (periodo) partes.push(periodo);
  if (filtrosTexto) partes.push(`Filtros: ${filtrosTexto}`);
  doc.fillColor('#C7CFE8').fontSize(8).text(partes.join(' · '), MARGEN, 64, { width: ANCHO_TABLA, height: 24, ellipsis: true });
  doc.x = MARGEN;
  doc.y = ALTO_BANDA + 14;
}

function dibujarFilaTarjetas(doc: PDFKit.PDFDocument, tarjetas: Tarjeta[], alto = 48) {
  const gap = 8;
  const anchoTarjeta = (ANCHO_TABLA - gap * (tarjetas.length - 1)) / tarjetas.length;
  const y = doc.y;
  let x = MARGEN;
  for (const tarjeta of tarjetas) {
    doc.roundedRect(x, y, anchoTarjeta, alto, 6).fillAndStroke(COLOR.papel, COLOR.linea);
    doc.fillColor(COLOR.suave).font('Helvetica').fontSize(7.5).text(tarjeta.etiqueta, x + 8, y + 8, { width: anchoTarjeta - 16, height: 12, ellipsis: true, lineBreak: false });
    doc.fillColor(tarjeta.acento ? COLOR.oro : COLOR.marino).font('Helvetica-Bold').fontSize(15).text(tarjeta.valor, x + 8, y + 22, { width: anchoTarjeta - 16, height: 20, ellipsis: true, lineBreak: false });
    x += anchoTarjeta + gap;
  }
  doc.y = y + alto + 8;
  doc.x = MARGEN;
}

function asegurarEspacio(doc: PDFKit.PDFDocument, alturaNecesaria: number, titulo: string, alSaltar?: () => void) {
  const limite = doc.page.height - doc.page.margins.bottom;
  if (doc.y + alturaNecesaria > limite) {
    doc.addPage();
    doc.fillColor(COLOR.suave).font('Helvetica').fontSize(8).text(`Venvios Express · ${titulo} (continuación)`, MARGEN, MARGEN - 10);
    doc.y = MARGEN + 10;
    doc.x = MARGEN;
    alSaltar?.();
  }
}

function dibujarEncabezadoTabla(doc: PDFKit.PDFDocument, columnas: Columna[]) {
  const y = doc.y;
  doc.rect(MARGEN, y, ANCHO_TABLA, ALTO_FILA).fill(COLOR.marino);
  let x = MARGEN;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.blanco);
  for (const columna of columnas) {
    doc.text(columna.titulo, x + 4, y + 5, { width: columna.ancho - 8, height: 12, ellipsis: true, lineBreak: false });
    x += columna.ancho;
  }
  doc.font('Helvetica');
  doc.y = y + ALTO_FILA;
  doc.x = MARGEN;
}

function dibujarBandaGrupo(doc: PDFKit.PDFDocument, titulo: string, subtitulo: string) {
  const yBanda = doc.y;
  doc.roundedRect(MARGEN, yBanda, ANCHO_TABLA, 30, 4).fill(COLOR.marino50);
  doc.fillColor(COLOR.marino).font('Helvetica-Bold').fontSize(10.5).text(titulo, MARGEN + 10, yBanda + 5, { width: ANCHO_TABLA - 20, height: 14, ellipsis: true, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave).text(subtitulo, MARGEN + 10, yBanda + 18, { width: ANCHO_TABLA - 20, height: 10, ellipsis: true, lineBreak: false });
  doc.y = yBanda + 34;
  doc.x = MARGEN;
}

function dibujarNotaSinResultados(doc: PDFKit.PDFDocument, mensaje: string) {
  doc.roundedRect(MARGEN, doc.y, ANCHO_TABLA, 36, 6).fillAndStroke(COLOR.papel, COLOR.linea);
  doc.fillColor(COLOR.suave).font('Helvetica-Bold').fontSize(10).text(mensaje, MARGEN + 12, doc.y + 12, { width: ANCHO_TABLA - 24 });
  doc.y += 46;
  doc.x = MARGEN;
}

function dibujarInventario(doc: PDFKit.PDFDocument, reporte: ReporteInventario) {
  const { resumen } = reporte;
  dibujarFilaTarjetas(doc, [
    { etiqueta: 'Total paquetes', valor: String(resumen.totalPaquetes) },
    { etiqueta: 'Peso total', valor: `${resumen.pesoTotalKg.toFixed(2)} kg` },
    { etiqueta: 'Sin avisar', valor: String(resumen.sinAvisar), acento: resumen.sinAvisar > 0 },
  ]);
  dibujarFilaTarjetas(doc, [
    { etiqueta: 'En bodega', valor: String(resumen.porEtapa.EN_BODEGA) },
    { etiqueta: 'Sin dueño', valor: String(resumen.porEtapa.SIN_DUENO) },
    { etiqueta: 'Esperando pago', valor: String(resumen.porEtapa.ESPERANDO_PAGO) },
    { etiqueta: 'Listo para salir', valor: String(resumen.porEtapa.LISTO_PARA_SALIR) },
  ]);
  doc.y += 4;

  if (reporte.clientes.length === 0) {
    dibujarNotaSinResultados(doc, 'Sin resultados: no hay paquetes que coincidan con los filtros aplicados.');
    return;
  }

  for (const grupo of reporte.clientes) {
    asegurarEspacio(doc, 54, TITULO_REPORTE.inventario);
    const codigo = grupo.cliente.codigo ? ` · ${grupo.cliente.codigo}` : '';
    dibujarBandaGrupo(doc, grupo.cliente.nombre, `${grupo.totalPaquetes} paquete(s)${codigo} · ${grupo.pesoTotalKg.toFixed(2)} kg`);
    dibujarEncabezadoTabla(doc, COLUMNAS_INVENTARIO);

    dibujarFilas(
      doc,
      COLUMNAS_INVENTARIO,
      grupo.items,
      TITULO_REPORTE.inventario,
      (item) => [
        item.tracking,
        item.etiquetaEtapa,
        textoOrigenCorto(item.origenEstado, item.prealertaOrigen),
        formatearKg(item.pesoKg),
        formatearFechaCorta(item.recibidoEn),
        formatearDias(item.diasEnBodega),
        item.etapa === 'SIN_DUENO' ? '—' : item.avisado ? 'Sí' : 'No',
        item.tieneFoto ? 'Sí' : 'No',
      ],
      (item, columna) =>
        COLUMNAS_INVENTARIO[columna]!.titulo === 'Días' && item.diasEnBodega !== null && item.diasEnBodega >= DIAS_ALERTA
          ? { fuente: 'Helvetica-Bold', color: COLOR.rojo }
          : ESTILO_NORMAL,
    );
    doc.y += 10;
  }
}

function dibujarTablaPrealertas(doc: PDFKit.PDFDocument, prealertas: PrealertaPendienteVista[], tituloPagina: string) {
  dibujarEncabezadoTabla(doc, COLUMNAS_PREALERTAS);
  dibujarFilas(
    doc,
    COLUMNAS_PREALERTAS,
    prealertas,
    tituloPagina,
    (p) => [p.tienda, formatearSoloFecha(p.fechaAviso), formatearDias(p.diasDesdeAviso), `${p.llegaron} de ${p.total}`, p.trackingsFaltantes.join(', ')],
    (_prealerta, columna) => (columna === 3 ? { fuente: 'Helvetica-Bold', color: COLOR.marino } : ESTILO_NORMAL),
  );
}

function dibujarPrealertasPendientes(doc: PDFKit.PDFDocument, reporte: ReportePrealertasPendientes) {
  const { resumen } = reporte;
  const tarjetas: Tarjeta[] = [
    { etiqueta: 'Prealertas pendientes', valor: String(resumen.totalPrealertas) },
    { etiqueta: 'Paquetes por llegar', valor: String(resumen.totalPaquetesPorLlegar) },
    { etiqueta: 'Clientes', valor: String(resumen.totalClientes) },
  ];
  if (resumen.sinRegistroPrealerta > 0) {
    tarjetas.push({ etiqueta: 'Sin registro de prealerta', valor: String(resumen.sinRegistroPrealerta), acento: true });
  }
  dibujarFilaTarjetas(doc, tarjetas);
  doc.y += 4;

  if (reporte.clientes.length === 0) {
    dibujarNotaSinResultados(doc, 'Sin resultados: no hay prealertas pendientes con los filtros aplicados.');
  } else {
    for (const grupo of reporte.clientes) {
      asegurarEspacio(doc, 54, TITULO_REPORTE['prealertas-pendientes']);
      dibujarBandaGrupo(doc, grupo.cliente.nombre, `${grupo.cliente.codigo} · ${grupo.totalPorLlegar} paquete(s) por llegar`);
      dibujarTablaPrealertas(doc, grupo.prealertas, TITULO_REPORTE['prealertas-pendientes']);
      doc.y += 10;
    }
  }

  if (resumen.sinRegistroPrealerta > 0) {
    asegurarEspacio(doc, 32, TITULO_REPORTE['prealertas-pendientes']);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave).text(
      `Nota: ${resumen.sinRegistroPrealerta} paquete(s) consolidado(s) antes de este cambio no tienen registro de prealerta de origen.`,
      MARGEN,
      doc.y,
      { width: ANCHO_TABLA },
    );
    doc.y += 14;
  }
}

function dibujarTituloBloque(doc: PDFKit.PDFDocument, titulo: string, subtitulo?: string) {
  asegurarEspacio(doc, 40, TITULO_REPORTE['estado-de-cuenta']);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLOR.marino).text(titulo, MARGEN, y);
  if (subtitulo) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave).text(subtitulo, MARGEN, y + 1, { width: ANCHO_TABLA, align: 'right' });
  }
  doc.y = y + 15;
  doc.x = MARGEN;
}

function dibujarConsolidadoCliente(doc: PDFKit.PDFDocument, consolidado: ConsolidadoEstadoCuenta) {
  asegurarEspacio(doc, 54, TITULO_REPORTE['estado-de-cuenta']);
  const pesoCalculado = consolidado.pesoTotalKg ?? sumaPesosKg(consolidado.paquetes);
  const peso = pesoCalculado !== null ? ` · ${pesoCalculado.toFixed(2)} kg` : '';
  const entrega = consolidado.entregadoEn ? ` · Entregado ${formatearSoloFecha(consolidado.entregadoEn)}` : '';
  dibujarBandaGrupo(
    doc,
    `Consolidación ${String(consolidado.numero).padStart(6, '0')} · ${consolidado.etiquetaEtapa}`,
    `${consolidado.etiquetaEstado} · ${consolidado.transportista} · ${consolidado.paquetes.length} paquete(s)${peso}${entrega}`,
  );
  dibujarEncabezadoTabla(doc, COLUMNAS_CONSOLIDADO_CLIENTE);
  dibujarFilas(doc, COLUMNAS_CONSOLIDADO_CLIENTE, consolidado.paquetes, TITULO_REPORTE['estado-de-cuenta'], (item) => [
    item.tracking,
    textoOrigenCorto(item.origenEstado, item.prealertaOrigen),
    formatearKg(item.pesoKg),
    formatearFechaCorta(item.recibidoEn),
    formatearDias(item.diasEnBodega),
  ]);
  doc.y += 10;
}

function dibujarEstadoCuenta(doc: PDFKit.PDFDocument, reporte: ReporteEstadoCuenta) {
  dibujarBandaGrupo(
    doc,
    `${reporte.cliente.nombre} · Casillero ${reporte.cliente.codigo}`,
    'Resumen por etapa · El historial completo de envíos anteriores está disponible en Envíos.',
  );

  const { porEtapa } = reporte.resumen;
  dibujarFilaTarjetas(doc, [
    { etiqueta: 'Por llegar', valor: String(porEtapa.POR_LLEGAR) },
    { etiqueta: 'En bodega', valor: String(porEtapa.EN_BODEGA) },
    { etiqueta: 'Esperando pago', valor: String(porEtapa.ESPERANDO_PAGO) },
  ], 45);
  dibujarFilaTarjetas(doc, [
    { etiqueta: 'Listo para salir', valor: String(porEtapa.LISTO_PARA_SALIR) },
    { etiqueta: 'En ruta', valor: String(porEtapa.EN_RUTA) },
    { etiqueta: 'Entregado', valor: String(porEtapa.ENTREGADO) },
  ], 45);
  doc.y += 4;

  if (reporte.resumen.totalPaquetes === 0) {
    dibujarNotaSinResultados(doc, 'Sin resultados: este cliente no tiene paquetes dentro de los criterios aplicados.');
  }

  if (reporte.prealertas.length > 0) {
    const porLlegar = reporte.prealertas.reduce((s, p) => s + p.faltan, 0);
    dibujarTituloBloque(doc, 'Prealertas pendientes', `${porLlegar} paquete(s) por llegar`);
    dibujarTablaPrealertas(doc, reporte.prealertas, TITULO_REPORTE['estado-de-cuenta']);
    doc.y += 10;
  }

  if (reporte.enBodega.length > 0) {
    const pesoBodega = sumaPesosKg(reporte.enBodega);
    const resumenBodega = `${reporte.enBodega.length} paquete(s)${pesoBodega !== null ? ` · ${pesoBodega.toFixed(2)} kg` : ''}`;
    dibujarTituloBloque(doc, 'Paquetes en bodega', resumenBodega);
    dibujarEncabezadoTabla(doc, COLUMNAS_BODEGA_CLIENTE);
    dibujarFilas(doc, COLUMNAS_BODEGA_CLIENTE, reporte.enBodega, TITULO_REPORTE['estado-de-cuenta'], (item) => [
      item.tracking,
      textoOrigenCorto(item.origenEstado, item.prealertaOrigen),
      formatearKg(item.pesoKg),
      formatearFechaCorta(item.recibidoEn),
      formatearDias(item.diasEnBodega),
      item.avisado ? 'Sí' : 'No',
      item.tieneFoto ? 'Sí' : 'No',
    ]);
    doc.y += 10;
  }

  if (reporte.consolidados.length > 0) {
    dibujarTituloBloque(doc, 'Consolidados sin entregar');
    for (const consolidado of reporte.consolidados) dibujarConsolidadoCliente(doc, consolidado);
  }

  if (reporte.resumen.incluyeEntregados) {
    if (reporte.entregados.length > 0) {
      dibujarTituloBloque(doc, 'Entregados en el periodo');
      for (const entregado of reporte.entregados) dibujarConsolidadoCliente(doc, entregado);
    } else {
      asegurarEspacio(doc, 24, TITULO_REPORTE['estado-de-cuenta']);
      doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave).text(
        'No hay envíos entregados dentro del periodo elegido.',
        MARGEN,
        doc.y,
        { width: ANCHO_TABLA },
      );
    }
  } else {
    asegurarEspacio(doc, 26, TITULO_REPORTE['estado-de-cuenta']);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave).text(
      'Sin periodo elegido: no se incluyen envíos entregados. El historial completo está en Envíos.',
      MARGEN,
      doc.y,
      { width: ANCHO_TABLA },
    );
  }
}

function dibujarPiePagina(doc: PDFKit.PDFDocument) {
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - margenInferior + 8;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO_TABLA, y).strokeColor(COLOR.oro).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(COLOR.suave).font('Helvetica').text(`Página ${i + 1} de ${rango.count} · Venvios Express`, MARGEN, y + 5, { width: ANCHO_TABLA, height: 12, ellipsis: true, lineBreak: false, align: 'center' });
    doc.page.margins.bottom = margenInferior;
  }
}

export function generarPdfReporte(reporte: ReporteGenerado, filtrosTexto = ''): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEN, size: 'A4', bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on('data', (trozo) => trozos.push(trozo));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);

    dibujarBandaMarca(doc, reporte, filtrosTexto);
    if (reporte.tipo === 'inventario') dibujarInventario(doc, reporte);
    else if (reporte.tipo === 'prealertas-pendientes') dibujarPrealertasPendientes(doc, reporte);
    else dibujarEstadoCuenta(doc, reporte);

    dibujarPiePagina(doc);
    doc.end();
  });
}
