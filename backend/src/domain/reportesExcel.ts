import { aExcel, fechaExcel, type CeldaExcel } from './excel';
import type {
  OrigenPaqueteEstado,
  PrealertaOrigenVista,
  ReporteEstadoCuenta,
  ReporteGenerado,
  ReporteInventario,
  ReportePrealertasPendientes,
} from './reportes';

function textoOrigen(estado: OrigenPaqueteEstado, origen: PrealertaOrigenVista | null): string {
  if (estado === 'PREALERTA' && origen) return origen.tienda;
  if (estado === 'SIN_PREALERTA') return 'Sin prealerta';
  return 'Sin registro de prealerta';
}

function kgExcel(kg: number | null): string | number {
  return kg === null ? '' : Number(kg.toFixed(2));
}

function numeroConsolidacion(numero: number): string {
  return `Consolidación ${String(numero).padStart(6, '0')}`;
}

export async function aExcelInventario(reporte: ReporteInventario): Promise<Buffer> {
  const encabezados = [
    'Cliente',
    'Casillero',
    'Tracking',
    'Etapa',
    'Prealerta origen',
    'Fecha prealerta (UTC)',
    'Peso (kg)',
    'Recibido (UTC)',
    'Días en bodega',
    'Avisado',
    'Con foto',
  ];
  const filas: CeldaExcel[][] = [];
  for (const grupo of reporte.clientes) {
    for (const item of grupo.items) {
      filas.push([
        grupo.cliente.nombre,
        grupo.cliente.codigo,
        item.tracking,
        item.etiquetaEtapa,
        textoOrigen(item.origenEstado, item.prealertaOrigen),
        fechaExcel(item.prealertaOrigen?.fecha),
        kgExcel(item.pesoKg),
        fechaExcel(item.recibidoEn),
        item.diasEnBodega,
        item.etapa === 'SIN_DUENO' ? '' : item.avisado,
        item.tieneFoto,
      ]);
    }
  }
  return aExcel('Inventario', encabezados, filas);
}

export async function aExcelPrealertasPendientes(reporte: ReportePrealertasPendientes): Promise<Buffer> {
  const encabezados = [
    'Cliente',
    'Casillero',
    'Tienda',
    'Fecha aviso (UTC)',
    'Días desde aviso',
    'Llegaron',
    'Tracking faltante',
  ];
  const filas: CeldaExcel[][] = [];
  for (const grupo of reporte.clientes) {
    for (const prealerta of grupo.prealertas) {
      for (const tracking of prealerta.trackingsFaltantes) {
        filas.push([
          grupo.cliente.nombre,
          grupo.cliente.codigo,
          prealerta.tienda,
          fechaExcel(prealerta.fechaAviso),
          prealerta.diasDesdeAviso,
          `${prealerta.llegaron} de ${prealerta.total}`,
          tracking,
        ]);
      }
    }
  }
  return aExcel('Prealertas pendientes', encabezados, filas);
}

export async function aExcelEstadoCuenta(reporte: ReporteEstadoCuenta): Promise<Buffer> {
  const encabezados = [
    'Cliente',
    'Casillero',
    'Etapa',
    'Estado envío',
    'Envío / Tienda',
    'Tracking',
    'Prealerta origen',
    'Fecha aviso (UTC)',
    'Peso (kg)',
    'Recibido (UTC)',
    'Días en bodega',
    'Avisado',
    'Entregado (UTC)',
  ];
  const filas: CeldaExcel[][] = [];
  const { cliente } = reporte;

  for (const prealerta of reporte.prealertas) {
    const estadoEnvio = prealerta.llegaron > 0 ? 'Recibido parcial' : 'Prealertado';
    for (const tracking of prealerta.trackingsFaltantes) {
      filas.push([
        cliente.nombre,
        cliente.codigo,
        'Por llegar',
        estadoEnvio,
        prealerta.tienda,
        tracking,
        prealerta.tienda,
        fechaExcel(prealerta.fechaAviso),
        '',
        '',
        '',
        '',
        '',
      ]);
    }
  }

  for (const item of reporte.enBodega) {
    filas.push([
      cliente.nombre,
      cliente.codigo,
      'En bodega',
      'En bodega',
      textoOrigen(item.origenEstado, item.prealertaOrigen),
      item.tracking,
      textoOrigen(item.origenEstado, item.prealertaOrigen),
      fechaExcel(item.prealertaOrigen?.fecha),
      kgExcel(item.pesoKg),
      fechaExcel(item.recibidoEn),
      item.diasEnBodega,
      item.avisado,
      '',
    ]);
  }

  for (const grupo of [...reporte.consolidados, ...reporte.entregados]) {
    const envioTexto = numeroConsolidacion(grupo.numero);
    for (const item of grupo.paquetes) {
      filas.push([
        cliente.nombre,
        cliente.codigo,
        grupo.etiquetaEtapa,
        grupo.etiquetaEstado,
        envioTexto,
        item.tracking,
        textoOrigen(item.origenEstado, item.prealertaOrigen),
        fechaExcel(item.prealertaOrigen?.fecha),
        kgExcel(item.pesoKg),
        fechaExcel(item.recibidoEn),
        item.diasEnBodega,
        item.avisado,
        fechaExcel(grupo.entregadoEn),
      ]);
    }
  }

  return aExcel('Estado de cuenta', encabezados, filas);
}

export async function aExcelReporte(reporte: ReporteGenerado): Promise<Buffer> {
  if (reporte.tipo === 'inventario') return aExcelInventario(reporte);
  if (reporte.tipo === 'prealertas-pendientes') return aExcelPrealertasPendientes(reporte);
  return aExcelEstadoCuenta(reporte);
}
