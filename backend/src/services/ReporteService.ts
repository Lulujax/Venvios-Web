import { esPrealertaReal, type EstadoEnvio } from '../domain/estados';
import {
  ETAPAS_INVENTARIO,
  ETIQUETAS_ETAPA,
  TIPOS_REPORTE,
  armarEstadoDeCuenta,
  armarInventario,
  armarPrealertasPendientes,
  validarPeriodo,
  type ClienteReporte,
  type EtapaInventario,
  type PaqueteDeOrigen,
  type PaqueteFuente,
  type PaqueteSinOrigenFuente,
  type PrealertaFuente,
  type ReporteGenerado,
  type TipoReporte,
} from '../domain/reportes';
import { aExcelReporte } from '../domain/reportesExcel';
import { generarPdfReporte } from '../pdf/reportesPdf';
import type { Envio, Hito, Repositorios, Usuario } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { TELEFONO_SIN_ASIGNAR, esPersonal, type Actor } from './EnvioService';

export interface ConsultaReporte {
  clienteId?: string;
  etapa?: EtapaInventario;
  minDias?: number;
  soloSinAvisar?: boolean;
  desde?: string;
  hasta?: string;
}

export interface ClienteFiltroVista {
  id: string;
  nombre: string;
  codigo: string;
}

export interface RespuestaReporte {
  reporte: ReporteGenerado;
  clienteFiltro: ClienteFiltroVista | null;
  filtrosTexto: string;
}

const ESTADOS_FISICOS_BODEGA: EstadoEnvio[] = [
  'RECIBIDO_PARCIAL',
  'RECIBIDO_COMPLETO',
  'POR_CONSOLIDAR',
  'POR_PAGAR',
  'POR_CONFIRMAR',
  'PAGADO',
];

const ESTADOS_ACTIVOS_PREALERTAS: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_PARCIAL'];

const ESTADOS_SIN_ORIGEN: EstadoEnvio[] = [
  'RECIBIDO_PARCIAL',
  'RECIBIDO_COMPLETO',
  'POR_CONSOLIDAR',
  'POR_PAGAR',
  'POR_CONFIRMAR',
  'PAGADO',
  'DESPACHADO',
  'CERRADO',
];

export class ReporteService {
  constructor(
    private readonly repos: Repositorios,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  private exigirPersonal(actor: Actor): void {
    if (!esPersonal(actor)) throw AppError.forbidden();
  }

  private validarTipo(tipo: string): TipoReporte {
    if (!(TIPOS_REPORTE as readonly string[]).includes(tipo)) {
      throw AppError.badRequest('Tipo de reporte no válido.', 'TIPO_REPORTE_INVALIDO');
    }
    return tipo as TipoReporte;
  }

  private async validarClienteFiltro(clienteId: string | undefined): Promise<ClienteFiltroVista | null> {
    if (!clienteId) return null;
    const usuario = await this.repos.usuarios.porId(clienteId);
    if (!usuario || usuario.rol !== 'CLIENTE' || usuario.telefono === TELEFONO_SIN_ASIGNAR) {
      throw AppError.notFound('El cliente no existe.');
    }
    return { id: usuario.id, nombre: usuario.nombre, codigo: usuario.codigo };
  }

  private validarConsulta(tipo: TipoReporte, consulta: ConsultaReporte) {
    validarPeriodo({ desde: consulta.desde, hasta: consulta.hasta });
    if (consulta.etapa !== undefined && !(ETAPAS_INVENTARIO as readonly string[]).includes(consulta.etapa)) {
      throw AppError.badRequest('Etapa de inventario no válida.');
    }
    if (consulta.minDias !== undefined && (!Number.isInteger(consulta.minDias) || consulta.minDias < 1)) {
      throw AppError.badRequest('Los días mínimos en bodega deben ser un entero positivo.');
    }
    if (tipo === 'estado-de-cuenta' && !consulta.clienteId) {
      throw AppError.badRequest('Elige un cliente para generar el estado de cuenta.', 'CLIENTE_REQUERIDO');
    }
  }

  private textoFiltros(tipo: TipoReporte, consulta: ConsultaReporte, clienteFiltro: ClienteFiltroVista | null): string {
    const partes: string[] = [];
    if (clienteFiltro && tipo !== 'estado-de-cuenta') {
      partes.push(`Cliente: ${clienteFiltro.nombre} (${clienteFiltro.codigo})`);
    }
    if (tipo === 'inventario') {
      if (consulta.etapa) partes.push(`Etapa: ${ETIQUETAS_ETAPA[consulta.etapa]}`);
      if (consulta.minDias) partes.push(`${consulta.minDias} días o más en bodega`);
      if (consulta.soloSinAvisar) partes.push('Solo sin avisar');
    }
    return partes.join(' · ');
  }

  private async mapaClientes(ids: string[]): Promise<Map<string, ClienteReporte>> {
    const usuarios = await this.repos.usuarios.porIds(ids);
    const mapa = new Map<string, ClienteReporte>();
    for (const u of usuarios) {
      const sinDueno = u.telefono === TELEFONO_SIN_ASIGNAR;
      mapa.set(u.id, {
        id: u.id,
        nombre: sinDueno ? 'Sin dueño' : u.nombre,
        codigo: sinDueno ? '' : u.codigo,
        sinDueno,
      });
    }
    return mapa;
  }

  private async mapaOrigenes(envios: Envio[]): Promise<Map<string, { id: string; tienda: string; fecha: Date }>> {
    const mapa = new Map<string, { id: string; tienda: string; fecha: Date }>();
    const conocidos = new Map<string, Envio>(envios.map((e) => [e.id, e]));
    const faltantes = new Set<string>();
    for (const envio of envios) {
      for (const p of envio.paquetes) {
        if (!p.prealertaOrigenId) continue;
        const local = conocidos.get(p.prealertaOrigenId);
        if (local) mapa.set(local.id, { id: local.id, tienda: local.tienda, fecha: local.creadoEn });
        else faltantes.add(p.prealertaOrigenId);
      }
    }
    if (faltantes.size > 0) {
      const cargados = await this.repos.envios.porIds([...faltantes]);
      for (const e of cargados) mapa.set(e.id, { id: e.id, tienda: e.tienda, fecha: e.creadoEn });
    }
    return mapa;
  }

  private convertirPaquetesFuente(
    envios: Envio[],
    clientes: Map<string, ClienteReporte>,
    origenes: Map<string, { id: string; tienda: string; fecha: Date }>,
    hitos: Map<string, Hito[]> = new Map(),
  ): PaqueteFuente[] {
    const fuentes: PaqueteFuente[] = [];
    for (const envio of envios) {
      const cliente = clientes.get(envio.clienteId);
      if (!cliente) continue;
      for (const p of envio.paquetes) {
        const origen = p.prealertaOrigenId ? (origenes.get(p.prealertaOrigenId) ?? null) : null;
        const hitoEntrega = (hitos.get(p.id) ?? []).find((h) => h.tipo === 'ENTREGADO');
        fuentes.push({
          paqueteId: p.id,
          tracking: p.trackingTexto,
          paqueteEstado: p.estado,
          pesoKg: p.pesoCentesimas === null ? null : p.pesoCentesimas / 100,
          recibidoEn: p.recibidoEn,
          avisado: Boolean(p.avisadoEn),
          tieneFoto: Boolean(p.fotoPath),
          envioId: envio.id,
          envioNumero: envio.numero,
          envioTipo: envio.tipo,
          envioEstado: envio.estado,
          envioTienda: envio.tienda,
          envioTransportista: envio.transportista,
          envioPesoTotalKg: envio.pesoTotalCentesimas === null ? null : envio.pesoTotalCentesimas / 100,
          envioCreadoEn: envio.creadoEn,
          envioActualizadoEn: envio.actualizadoEn,
          entregadoEn: hitoEntrega?.creadoEn ?? envio.actualizadoEn,
          prealertaOrigen: origen,
          cliente,
        });
      }
    }
    return fuentes;
  }

  private async construirPrealertasFuente(
    alertas: Envio[],
    clientes: Map<string, ClienteReporte>,
    sinDuenoId: string | null,
  ): Promise<PrealertaFuente[]> {
    const reales = alertas.filter((a) => esPrealertaReal(a));
    if (reales.length === 0) return [];
    const hijos = await this.repos.envios.paquetesPorOrigen(reales.map((a) => a.id));
    const porOrigen = new Map<string, PaqueteDeOrigen[]>();
    for (const { paquete, envioTipo, envioEstado, envioClienteId } of hijos) {
      const origenId = paquete.prealertaOrigenId;
      if (!origenId) continue;
      const lista = porOrigen.get(origenId) ?? [];
      lista.push({
        paqueteId: paquete.id,
        tracking: paquete.trackingTexto,
        paqueteEstado: paquete.estado,
        envioTipo,
        envioEstado,
        sinDueno: sinDuenoId !== null && envioClienteId === sinDuenoId,
      });
      porOrigen.set(origenId, lista);
    }
    const resultado: PrealertaFuente[] = [];
    for (const alerta of reales) {
      const cliente = clientes.get(alerta.clienteId);
      if (!cliente || cliente.sinDueno) continue;
      resultado.push({
        envioId: alerta.id,
        tienda: alerta.tienda,
        fechaAviso: alerta.creadoEn,
        cliente,
        paquetesDeOrigen: porOrigen.get(alerta.id) ?? [],
      });
    }
    return resultado;
  }

  private async generarInventario(consulta: ConsultaReporte, ahora: Date) {
    const envios = await this.repos.envios.listar({
      clienteId: consulta.clienteId,
      estados: ESTADOS_FISICOS_BODEGA,
    });
    const [clientes, origenes] = await Promise.all([
      this.mapaClientes(envios.map((e) => e.clienteId)),
      this.mapaOrigenes(envios),
    ]);
    const fuentes = this.convertirPaquetesFuente(envios, clientes, origenes);
    return armarInventario(fuentes, consulta, ahora);
  }

  private async generarPrealertasPendientes(consulta: ConsultaReporte, ahora: Date) {
    const [alertas, paraSinOrigen, sinDuenoUsuario] = await Promise.all([
      this.repos.envios.listar({ clienteId: consulta.clienteId, estados: ESTADOS_ACTIVOS_PREALERTAS }),
      this.repos.envios.listar({ clienteId: consulta.clienteId, estados: ESTADOS_SIN_ORIGEN }),
      this.repos.usuarios.porTelefono(TELEFONO_SIN_ASIGNAR, 'CLIENTE'),
    ]);
    const clientes = await this.mapaClientes(alertas.map((a) => a.clienteId));
    const prealertas = await this.construirPrealertasFuente(alertas, clientes, sinDuenoUsuario?.id ?? null);
    const sinOrigen: PaqueteSinOrigenFuente[] = [];
    for (const envio of paraSinOrigen) {
      const sinDueno = sinDuenoUsuario !== null && envio.clienteId === sinDuenoUsuario.id;
      for (const p of envio.paquetes) {
        if (p.prealertaOrigenId !== null) continue;
        sinOrigen.push({
          paqueteId: p.id,
          clienteId: envio.clienteId,
          fechaReferencia: p.recibidoEn ?? envio.creadoEn,
          paqueteEstado: p.estado,
          envioTipo: envio.tipo,
          envioEstado: envio.estado,
          envioTienda: envio.tienda,
          sinDueno,
        });
      }
    }
    return armarPrealertasPendientes(prealertas, sinOrigen, consulta, ahora);
  }

  private async generarEstadoCuenta(cliente: ClienteFiltroVista, consulta: ConsultaReporte, ahora: Date) {
    const envios = await this.repos.envios.listar({
      clienteId: cliente.id,
      excluirEstados: ['CANCELADO', 'ARCHIVADO'],
    });
    const conPeriodo = Boolean(consulta.desde || consulta.hasta);
    const idsCerrados = conPeriodo
      ? envios.filter((e) => e.estado === 'CERRADO').flatMap((e) => e.paquetes.map((p) => p.id))
      : [];
    const [origenes, hitos, sinDuenoUsuario] = await Promise.all([
      this.mapaOrigenes(envios),
      idsCerrados.length > 0 ? this.repos.hitos.dePaquetes(idsCerrados) : Promise.resolve(new Map<string, Hito[]>()),
      this.repos.usuarios.porTelefono(TELEFONO_SIN_ASIGNAR, 'CLIENTE'),
    ]);
    const clienteReporte: ClienteReporte = { id: cliente.id, nombre: cliente.nombre, codigo: cliente.codigo, sinDueno: false };
    const clientes = new Map<string, ClienteReporte>([[cliente.id, clienteReporte]]);
    const alertasPendientes = envios.filter((e) => e.tipo === 'ALERTA' && ESTADOS_ACTIVOS_PREALERTAS.includes(e.estado));
    const prealertas = await this.construirPrealertasFuente(alertasPendientes, clientes, sinDuenoUsuario?.id ?? null);
    const fuentes = this.convertirPaquetesFuente(envios, clientes, origenes, hitos);
    return armarEstadoDeCuenta(clienteReporte, prealertas, fuentes, { desde: consulta.desde, hasta: consulta.hasta }, ahora);
  }

  private nombreBaseArchivo(tipo: TipoReporte, clienteFiltro: ClienteFiltroVista | null, ahora: Date): string {
    const fecha = ahora.toISOString().slice(0, 10);
    if (tipo === 'estado-de-cuenta') {
      const casillero = (clienteFiltro?.codigo ?? 'cliente').replace(/[^A-Za-z0-9-]/g, '') || 'cliente';
      return `estado-de-cuenta-${casillero}-${fecha}`;
    }
    return `${tipo}-${fecha}`;
  }

  async generar(actor: Actor, tipoCrudo: string, consulta: ConsultaReporte = {}): Promise<RespuestaReporte> {
    this.exigirPersonal(actor);
    const tipo = this.validarTipo(tipoCrudo);
    this.validarConsulta(tipo, consulta);
    const clienteFiltro = await this.validarClienteFiltro(consulta.clienteId);
    const ahora = this.reloj();

    let reporte: ReporteGenerado;
    if (tipo === 'inventario') reporte = await this.generarInventario(consulta, ahora);
    else if (tipo === 'prealertas-pendientes') reporte = await this.generarPrealertasPendientes(consulta, ahora);
    else reporte = await this.generarEstadoCuenta(clienteFiltro!, consulta, ahora);

    const filtrosTexto = this.textoFiltros(tipo, consulta, clienteFiltro);
    logger.info('Reporte generado', { actor: actor.id, tipo });
    return { reporte, clienteFiltro, filtrosTexto };
  }

  async generarPdf(actor: Actor, tipoCrudo: string, consulta: ConsultaReporte = {}): Promise<{ nombre: string; buffer: Buffer }> {
    const { reporte, clienteFiltro, filtrosTexto } = await this.generar(actor, tipoCrudo, consulta);
    const buffer = await generarPdfReporte(reporte, filtrosTexto);
    const nombre = `${this.nombreBaseArchivo(reporte.tipo, clienteFiltro, new Date(reporte.generadoEn))}.pdf`;
    logger.info('PDF de reporte generado', { actor: actor.id, tipo: reporte.tipo });
    return { nombre, buffer };
  }

  async generarExcel(actor: Actor, tipoCrudo: string, consulta: ConsultaReporte = {}): Promise<{ nombre: string; buffer: Buffer }> {
    const { reporte, clienteFiltro } = await this.generar(actor, tipoCrudo, consulta);
    const buffer = await aExcelReporte(reporte);
    const nombre = `${this.nombreBaseArchivo(reporte.tipo, clienteFiltro, new Date(reporte.generadoEn))}.xlsx`;
    logger.info('Excel de reporte generado', { actor: actor.id, tipo: reporte.tipo });
    return { nombre, buffer };
  }
}
