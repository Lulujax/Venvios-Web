export interface ItemInformeBodega {
  tracking: string;
  pesoKg: number | null;
  recibidoEn: string | null;
  diasEnBodega: number | null;
  avisado: boolean;
  tieneFoto: boolean;
  tipoEnvio: 'ALERTA' | 'CONSOLIDADO';
  sinDueno: boolean;
  enCamino: boolean;
  cliente: { id: string; nombre: string; codigo: string };
}

export interface ClienteInformeBodega {
  cliente: { id: string; nombre: string; codigo: string };
  items: ItemInformeBodega[];
  totalPaquetes: number;
  totalEnCamino: number;
  pesoTotalKg: number;
}

export interface ResumenInformeBodega {
  totalPaquetes: number;
  pesoTotalKg: number;
  sinDueno: number;
  sinAvisar: number;
  totalEnCamino: number;
}

export interface InformeBodega {
  generadoEn: string;
  resumen: ResumenInformeBodega;
  clientes: ClienteInformeBodega[];
}

function redondearKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

export function armarInformeBodega(items: ItemInformeBodega[], generadoEn: Date = new Date()): InformeBodega {
  const porCliente = new Map<string, ClienteInformeBodega>();
  for (const item of items) {
    const clave = item.cliente.id;
    let grupo = porCliente.get(clave);
    if (!grupo) {
      grupo = { cliente: item.cliente, items: [], totalPaquetes: 0, totalEnCamino: 0, pesoTotalKg: 0 };
      porCliente.set(clave, grupo);
    }
    grupo.items.push(item);
    if (item.enCamino) grupo.totalEnCamino += 1;
    else {
      grupo.totalPaquetes += 1;
      grupo.pesoTotalKg = redondearKg(grupo.pesoTotalKg + (item.pesoKg ?? 0));
    }
  }

  const clientes = [...porCliente.values()].sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre));
  const recibidos = items.filter((item) => !item.enCamino);
  const resumen: ResumenInformeBodega = {
    totalPaquetes: recibidos.length,
    pesoTotalKg: redondearKg(recibidos.reduce((suma, item) => suma + (item.pesoKg ?? 0), 0)),
    sinDueno: recibidos.filter((item) => item.sinDueno).length,
    sinAvisar: recibidos.filter((item) => !item.sinDueno && !item.avisado).length,
    totalEnCamino: items.length - recibidos.length,
  };

  return { generadoEn: generadoEn.toISOString(), resumen, clientes };
}
