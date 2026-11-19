import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { CifradoCedula } from '../domain/cifrado';
import { dolaresABolivaresCentavos } from '../domain/dinero';
import {
  ETIQUETAS_ESTADO,
  validarDespacho,
  validarTransicion,
  type DatosEntrega,
  type EstadoEnvio,
} from '../domain/estados';
import {
  calcularPrecio,
  kilosACentesimas,
  modalidadPropuesta,
  type Modalidad,
} from '../domain/tarifas';
import { coincidenTrackings, normalizarTracking } from '../domain/tracking';
import {
  limpiarTexto,
  validarCedula,
  validarPesoKg,
  validarTelefono,
  validarValorDeclarado,
} from '../domain/validaciones';
import type { Envio, Paquete, Repositorios, Rol, Transportista, Usuario } from '../repositories/tipos';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { enmascararCedula } from '../utils/mask';
import {
  rutaArchivo,
  validarImagen,
  type Almacenamiento,
  type ArchivoEntrada,
} from './Almacenamiento';
import type { ConfigService } from './ConfigService';
import type { TasaService, TasaVigente } from './TasaService';

export interface Actor {
  id: string;
  rol: Rol;
}

export interface PaqueteVista {
  id: string;
  tracking: string;
  recibido: boolean;
  pesoKg: number | null;
  tieneFoto: boolean;
  fotoRuta: string | null;
  avisado: boolean;
}

export interface PagoVista {
  id: string;
  estado: string;
  metodo: string;
  moneda: string;
  montoOriginalCentavos: number;
  montoUsdCentavos: number;
  referencia: string | null;
  tieneComprobante: boolean;
  comprobanteRuta: string | null;
  motivoRechazo: string | null;
  creadoEn: string;
}

export interface EnvioVista {
  id: string;
  estado: EstadoEnvio;
  etiquetaEstado: string;
  modalidad: Modalidad;
  modalidadSugerida: Modalidad | null;
  transportista: Transportista;
  tienda: string;
  valorDeclaradoCentavos: number;
  cliente: { id: string; nombre: string; telefono: string; cedulaEnmascarada: string };
  paquetes: PaqueteVista[];
  faltan: number;
  pesoTotalKg: number | null;
  precio: {
    pesoCobrableKg: number;
    precioPorKgCentavos: number;
    fleteCentavos: number;
    seguroCentavos: number;
    totalCentavos: number;
    totalBsCentavos: number | null;
  } | null;
  tasa: { bolivaresPorUsd: number; fecha: string; desactualizada: boolean } | null;
  entrega: { nombre: string | null; cedula: string | null; telefono: string | null; agencia: string | null; ciudad: string | null; estado: string | null };
  guia: { numero: string | null; tieneFoto: boolean; fotoRuta: string | null };
  pagos: PagoVista[];
  pagadoCentavos: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface NuevaPrealerta {
  clienteId?: string;
  trackings: string[];
  tienda: string;
  valorDeclaradoUsd: number;
  modalidad: Modalidad;
  transportista: Transportista;
}

export type ResultadoEscaneo =
  | { resultado: 'RECIBIDO' | 'YA_REGISTRADO'; envioId: string; paqueteId: string; cliente: string; faltan: number; texto: string }
  | { resultado: 'SIN_PREALERTA'; texto: string };

const MAX_TRACKINGS = 20;
const TELEFONO_SIN_ASIGNAR = '0000000000';
const ESTADOS_EDITABLES: EstadoEnvio[] = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];

export function esPersonal(actor: Actor): boolean {
  return actor.rol === 'OPERADOR' || actor.rol === 'ADMIN';
}

export class EnvioService {
  constructor(
    private readonly repos: Repositorios,
    private readonly cifrado: CifradoCedula,
    private readonly config: ConfigService,
    private readonly tasas: TasaService,
    private readonly almacenamiento: Almacenamiento,
  ) {}

  private async evento(envioId: string, actor: Actor | null, tipo: string, detalle: string, datos?: Record<string, unknown>): Promise<void> {
    await this.repos.envios.agregarEvento({ envioId, actorId: actor?.id ?? null, tipo, detalle, datos: datos ?? null });
  }

  private async cargar(envioId: string): Promise<Envio> {
    const envio = await this.repos.envios.porId(envioId);
    if (!envio) throw AppError.notFound('El envío no existe.');
    return envio;
  }

  private exigirAcceso(actor: Actor, envio: Envio): void {
    if (esPersonal(actor)) return;
    if (envio.clienteId !== actor.id) throw AppError.notFound('El envío no existe.');
  }

  private async tasaOpcional(): Promise<TasaVigente | null> {
    try {
      return await this.tasas.vigente();
    } catch {
      return null;
    }
  }

  async obtenerEnvio(actor: Actor, envioId: string): Promise<Envio> {
    const envio = await this.cargar(envioId);
    this.exigirAcceso(actor, envio);
    return envio;
  }

  async vista(envio: Envio): Promise<EnvioVista> {
    const cliente = await this.repos.usuarios.porId(envio.clienteId);
    if (!cliente) throw new AppError('El envío no tiene cliente asociado.', 500, 'INTERNO');
    const pagos = await this.repos.pagos.deEnvio(envio.id);
    const tasa = await this.tasaOpcional();
    const pesoTotal = envio.pesoTotalCentesimas;
    const recibidos = envio.paquetes.filter((p) => p.estado === 'RECIBIDO');
    const pagadoCentavos = pagos.filter((p) => p.estado === 'CONFIRMADO').reduce((suma, p) => suma + p.montoUsdCentavos, 0);

    return {
      id: envio.id,
      estado: envio.estado,
      etiquetaEstado: ETIQUETAS_ESTADO[envio.estado],
      modalidad: envio.modalidad,
      modalidadSugerida: pesoTotal ? modalidadPropuesta(pesoTotal) : null,
      transportista: envio.transportista,
      tienda: envio.tienda,
      valorDeclaradoCentavos: envio.valorDeclaradoCentavos,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        cedulaEnmascarada: enmascararCedula(this.cifrado.descifrar(cliente.cedulaCifrada)),
      },
      paquetes: envio.paquetes.map((p) => ({
        id: p.id,
        tracking: p.trackingTexto,
        recibido: p.estado === 'RECIBIDO',
        pesoKg: p.pesoCentesimas ? p.pesoCentesimas / 100 : null,
        tieneFoto: Boolean(p.fotoPath),
        fotoRuta: p.fotoPath,
        avisado: Boolean(p.avisadoEn),
      })),
      faltan: envio.paquetes.length - recibidos.length,
      pesoTotalKg: pesoTotal ? pesoTotal / 100 : null,
      precio:
        envio.totalCentavos !== null && envio.pesoCobrableCentesimas !== null
          ? {
              pesoCobrableKg: envio.pesoCobrableCentesimas / 100,
              precioPorKgCentavos: Math.round(((envio.fleteCentavos ?? 0) * 100) / Math.max(envio.pesoCobrableCentesimas, 1)),
              fleteCentavos: envio.fleteCentavos ?? 0,
              seguroCentavos: envio.seguroCentavos ?? 0,
              totalCentavos: envio.totalCentavos,
              totalBsCentavos: tasa ? dolaresABolivaresCentavos(envio.totalCentavos, tasa.bolivaresPorUsd) : null,
            }
          : null,
      tasa: tasa ? { bolivaresPorUsd: tasa.bolivaresPorUsd, fecha: tasa.fecha, desactualizada: tasa.desactualizada } : null,
      entrega: {
        nombre: envio.entrega.nombre,
        cedula: envio.entrega.cedulaCifrada ? this.cifrado.descifrar(envio.entrega.cedulaCifrada) : null,
        telefono: envio.entrega.telefono,
        agencia: envio.entrega.agencia,
        ciudad: envio.entrega.ciudad,
        estado: envio.entrega.estado,
      },
      guia: { numero: envio.guiaVenezolana, tieneFoto: Boolean(envio.guiaFotoPath), fotoRuta: envio.guiaFotoPath },
      pagos: pagos.map((p) => ({
        id: p.id,
        estado: p.estado,
        metodo: p.metodo,
        moneda: p.moneda,
        montoOriginalCentavos: p.montoOriginalCentavos,
        montoUsdCentavos: p.montoUsdCentavos,
        referencia: p.referencia,
        tieneComprobante: Boolean(p.comprobantePath),
        comprobanteRuta: p.comprobantePath,
        motivoRechazo: p.motivoRechazo,
        creadoEn: p.creadoEn.toISOString(),
      })),
      pagadoCentavos,
      creadoEn: envio.creadoEn.toISOString(),
      actualizadoEn: envio.actualizadoEn.toISOString(),
    };
  }

  async detalle(actor: Actor, envioId: string): Promise<EnvioVista> {
    return this.vista(await this.obtenerEnvio(actor, envioId));
  }

  async historial(actor: Actor, envioId: string) {
    if (!esPersonal(actor)) throw AppError.forbidden();
    await this.cargar(envioId);
    const eventos = await this.repos.envios.eventosDe(envioId);
    return eventos.map((e) => ({ tipo: e.tipo, detalle: e.detalle, actorId: e.actorId, fecha: e.creadoEn.toISOString() }));
  }

  async listar(actor: Actor, filtro: { estado?: EstadoEnvio; q?: string } = {}): Promise<EnvioVista[]> {
    const envios = await this.repos.envios.listar({
      clienteId: esPersonal(actor) ? undefined : actor.id,
      estados: filtro.estado ? [filtro.estado] : undefined,
    });
    const vistas = await Promise.all(envios.map((e) => this.vista(e)));
    const q = filtro.q?.trim().toLowerCase();
    if (!q || !esPersonal(actor)) return vistas;
    const digitos = q.replace(/\D/g, '');
    return vistas.filter(
      (v) =>
        v.cliente.nombre.toLowerCase().includes(q) ||
        (digitos.length >= 4 && v.cliente.telefono.includes(digitos)) ||
        v.paquetes.some((p) => p.tracking.toLowerCase().includes(q)) ||
        (v.guia.numero?.toLowerCase().includes(q) ?? false),
    );
  }

  async crearPrealerta(actor: Actor, datos: NuevaPrealerta): Promise<EnvioVista> {
    logger.info('Creando prealerta', { actor: actor.id, paquetes: datos.trackings?.length });
    const clienteId = esPersonal(actor) ? datos.clienteId : actor.id;
    if (!clienteId) throw AppError.badRequest('Indica el cliente de la prealerta.');
    const cliente = await this.repos.usuarios.porId(clienteId);
    if (!cliente || cliente.rol !== 'CLIENTE' || !cliente.activo) throw AppError.notFound('El cliente no existe o no está activo.');
    if (!['M1', 'M2'].includes(datos.modalidad)) throw AppError.badRequest('Elige una modalidad válida.');
    if (!['MRW', 'ZOOM'].includes(datos.transportista)) throw AppError.badRequest('Elige MRW o Zoom.');
    if (!Array.isArray(datos.trackings) || datos.trackings.length === 0) {
      throw AppError.badRequest('Agrega al menos un número de tracking.');
    }
    if (datos.trackings.length > MAX_TRACKINGS) throw AppError.badRequest(`Máximo ${MAX_TRACKINGS} paquetes por envío.`);

    const vistos = new Set<string>();
    const paquetes = datos.trackings.map((texto) => {
      const trackingNormalizado = normalizarTracking(limpiarTexto(texto, 80));
      if (vistos.has(trackingNormalizado)) throw AppError.badRequest('Repetiste un tracking en la lista.');
      vistos.add(trackingNormalizado);
      return { trackingTexto: limpiarTexto(texto, 80), trackingNormalizado };
    });

    for (const paquete of paquetes) {
      const existente = await this.repos.envios.porTracking(paquete.trackingNormalizado);
      if (existente) {
        const puedeVer = esPersonal(actor) || existente.clienteId === actor.id;
        throw AppError.conflict(
          `El tracking ${paquete.trackingTexto} ya está registrado.`,
          puedeVer ? { envioId: existente.id } : undefined,
        );
      }
    }

    const envio = await this.repos.envios.crear({
      clienteId,
      modalidad: datos.modalidad,
      transportista: datos.transportista,
      tienda: limpiarTexto(datos.tienda, 80) || 'Sin indicar',
      valorDeclaradoCentavos: validarValorDeclarado(Number(datos.valorDeclaradoUsd)),
      paquetes,
    });
    await this.evento(envio.id, actor, 'PREALERTA', `Prealerta con ${paquetes.length} paquete(s)`);
    logger.info('Prealerta creada', { envio: envio.id, paquetes: paquetes.length });
    return this.vista(envio);
  }

  async editarDatos(
    actor: Actor,
    envioId: string,
    cambios: { modalidad?: Modalidad; transportista?: Transportista; valorDeclaradoUsd?: number; tienda?: string },
  ): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    if (!ESTADOS_EDITABLES.includes(envio.estado)) {
      throw AppError.badRequest('Este envío ya no admite cambios. Pide ayuda en la oficina.', 'ENVIO_BLOQUEADO');
    }
    if (!esPersonal(actor) && (cambios.valorDeclaradoUsd !== undefined || cambios.tienda !== undefined)) {
      if (envio.estado !== 'PREALERTADO') throw AppError.forbidden('El valor declarado solo se cambia antes de recibir el paquete.');
    }
    const parcial: Parameters<typeof this.repos.envios.actualizar>[1] = {};
    if (cambios.modalidad) {
      if (!['M1', 'M2'].includes(cambios.modalidad)) throw AppError.badRequest('Modalidad inválida.');
      parcial.modalidad = cambios.modalidad;
    }
    if (cambios.transportista) {
      if (!['MRW', 'ZOOM'].includes(cambios.transportista)) throw AppError.badRequest('Transportista inválido.');
      parcial.transportista = cambios.transportista;
    }
    if (cambios.valorDeclaradoUsd !== undefined) parcial.valorDeclaradoCentavos = validarValorDeclarado(cambios.valorDeclaradoUsd);
    if (cambios.tienda !== undefined) parcial.tienda = limpiarTexto(cambios.tienda, 80) || 'Sin indicar';
    const actualizado = await this.repos.envios.actualizar(envioId, parcial);
    await this.evento(envioId, actor, 'EDICION', `Datos del envío editados: ${Object.keys(parcial).join(', ')}`);
    return this.vista(await this.recalcular(actualizado));
  }

  private async recalcular(envio: Envio): Promise<Envio> {
    const recibidos = envio.paquetes.filter((p) => p.estado === 'RECIBIDO');
    if (recibidos.length === 0 || recibidos.some((p) => p.pesoCentesimas === null)) return envio;
    const pesoTotal = recibidos.reduce((suma, p) => suma + (p.pesoCentesimas ?? 0), 0);
    const precio = calcularPrecio(envio.modalidad, pesoTotal, envio.valorDeclaradoCentavos, await this.config.tarifas());
    return this.repos.envios.actualizar(envio.id, {
      pesoTotalCentesimas: pesoTotal,
      pesoCobrableCentesimas: precio.pesoCobrableCentesimas,
      fleteCentavos: precio.fleteCentavos,
      seguroCentavos: precio.seguroCentavos,
      totalCentavos: precio.totalCentavos,
    });
  }

  private async ajustarEstadoRecepcion(envio: Envio): Promise<Envio> {
    if (!['PREALERTADO', 'RECIBIDO_PARCIAL'].includes(envio.estado)) return envio;
    const todos = envio.paquetes.every((p) => p.estado === 'RECIBIDO');
    const alguno = envio.paquetes.some((p) => p.estado === 'RECIBIDO');
    const nuevo: EstadoEnvio = todos ? 'RECIBIDO_COMPLETO' : alguno ? 'RECIBIDO_PARCIAL' : 'PREALERTADO';
    if (nuevo === envio.estado) return envio;
    validarTransicion(envio.estado, nuevo);
    return this.repos.envios.actualizar(envio.id, { estado: nuevo });
  }

  private async buscarPaquete(texto: string): Promise<{ envio: Envio; paquete: Paquete } | null> {
    const normalizado = normalizarTracking(texto);
    const exacto = await this.repos.envios.porTracking(normalizado);
    if (exacto) {
      const paquete = exacto.paquetes.find((p) => p.trackingNormalizado === normalizado)!;
      return { envio: exacto, paquete };
    }
    const pendientes = await this.repos.envios.listar({ estados: ['PREALERTADO', 'RECIBIDO_PARCIAL'] });
    for (const envio of pendientes) {
      const paquete = envio.paquetes.find((p) => coincidenTrackings(p.trackingNormalizado, normalizado));
      if (paquete) return { envio, paquete };
    }
    return null;
  }

  async escanear(actor: Actor, textoLeido: string): Promise<ResultadoEscaneo> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const texto = limpiarTexto(textoLeido, 120);
    logger.info('Escaneo recibido', { actor: actor.id, largo: texto.length });
    const hallado = await this.buscarPaquete(texto);
    if (!hallado) return { resultado: 'SIN_PREALERTA', texto };

    const cliente = await this.repos.usuarios.porId(hallado.envio.clienteId);
    const nombre = cliente?.nombre ?? 'Cliente';
    if (hallado.paquete.estado === 'RECIBIDO') {
      const faltan = hallado.envio.paquetes.filter((p) => p.estado === 'ESPERADO').length;
      return { resultado: 'YA_REGISTRADO', envioId: hallado.envio.id, paqueteId: hallado.paquete.id, cliente: nombre, faltan, texto };
    }

    await this.repos.envios.actualizarPaquete(hallado.paquete.id, {
      estado: 'RECIBIDO',
      recibidoPorId: actor.id,
      recibidoEn: new Date(),
    });
    const refrescado = await this.ajustarEstadoRecepcion(await this.cargar(hallado.envio.id));
    await this.evento(refrescado.id, actor, 'RECEPCION', 'Paquete recibido en la oficina');
    const faltan = refrescado.paquetes.filter((p) => p.estado === 'ESPERADO').length;
    logger.info('Paquete recibido', { envio: refrescado.id, faltan });
    return { resultado: 'RECIBIDO', envioId: refrescado.id, paqueteId: hallado.paquete.id, cliente: nombre, faltan, texto };
  }

  private async clienteSinAsignar(): Promise<Usuario> {
    const existente = await this.repos.usuarios.porTelefono(TELEFONO_SIN_ASIGNAR);
    if (existente) return existente;
    return this.repos.usuarios.crear({
      nombre: 'Sin asignar',
      cedulaCifrada: this.cifrado.cifrar('00000'),
      cedulaHuella: 'sin-asignar',
      telefono: TELEFONO_SIN_ASIGNAR,
      passwordHash: await hash(randomBytes(16).toString('hex')),
      rol: 'CLIENTE',
      activo: false,
      debeCambiarClave: false,
    });
  }

  async registrarSinPrealerta(actor: Actor, textoLeido: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const texto = limpiarTexto(textoLeido, 80);
    const normalizado = normalizarTracking(texto);
    if (await this.repos.envios.porTracking(normalizado)) throw AppError.conflict('Ese tracking ya está registrado.');
    const sinAsignar = await this.clienteSinAsignar();
    const envio = await this.repos.envios.crear({
      clienteId: sinAsignar.id,
      modalidad: 'M2',
      transportista: 'MRW',
      tienda: 'Sin prealerta',
      valorDeclaradoCentavos: 0,
      paquetes: [{ trackingTexto: texto, trackingNormalizado: normalizado }],
    });
    await this.repos.envios.actualizarPaquete(envio.paquetes[0]!.id, { estado: 'RECIBIDO', recibidoPorId: actor.id, recibidoEn: new Date() });
    const ajustado = await this.ajustarEstadoRecepcion(await this.cargar(envio.id));
    await this.evento(envio.id, actor, 'SIN_PREALERTA', 'Paquete recibido sin prealerta; falta asignar cliente');
    return this.vista(ajustado);
  }

  async asignarCliente(actor: Actor, envioId: string, clienteId: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const cliente = await this.repos.usuarios.porId(clienteId);
    if (!cliente || cliente.rol !== 'CLIENTE' || !cliente.activo) throw AppError.notFound('El cliente no existe o no está activo.');
    await this.cargar(envioId);
    const actualizado = await this.repos.envios.actualizar(envioId, { clienteId });
    await this.evento(envioId, actor, 'ASIGNACION', 'Envío asignado a un cliente', { clienteId });
    return this.vista(actualizado);
  }

  async registrarPeso(actor: Actor, paqueteId: string, pesoKg: number): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const { envio, paquete } = await this.buscarPorPaqueteId(paqueteId);
    if (paquete.estado !== 'RECIBIDO') throw AppError.badRequest('Primero escanea y recibe el paquete.');
    if (!ESTADOS_EDITABLES.includes(envio.estado)) {
      throw AppError.badRequest('El envío ya está en cobro; no se puede cambiar el peso.', 'ENVIO_BLOQUEADO');
    }
    const peso = validarPesoKg(pesoKg);
    await this.repos.envios.actualizarPaquete(paqueteId, { pesoCentesimas: kilosACentesimas(peso) });
    const recalculado = await this.recalcular(await this.cargar(envio.id));
    await this.evento(envio.id, actor, 'PESO', `Peso registrado: ${peso.toFixed(2)} kg`);
    return this.vista(recalculado);
  }

  private async buscarPorPaqueteId(paqueteId: string): Promise<{ envio: Envio; paquete: Paquete }> {
    const todos = await this.repos.envios.listar({});
    for (const envio of todos) {
      const paquete = envio.paquetes.find((p) => p.id === paqueteId);
      if (paquete) return { envio, paquete };
    }
    throw AppError.notFound('El paquete no existe.');
  }

  async registrarFotoPaquete(actor: Actor, paqueteId: string, archivo: ArchivoEntrada | undefined): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const valido = validarImagen(archivo);
    const { envio } = await this.buscarPorPaqueteId(paqueteId);
    const ruta = rutaArchivo('paquetes', envio.id, valido.mime);
    await this.almacenamiento.subir(ruta, valido);
    await this.repos.envios.actualizarPaquete(paqueteId, { fotoPath: ruta });
    await this.evento(envio.id, actor, 'FOTO', 'Foto del paquete guardada');
    return this.vista(await this.cargar(envio.id));
  }

  async marcarAvisado(actor: Actor, paqueteId: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const { envio } = await this.buscarPorPaqueteId(paqueteId);
    await this.repos.envios.actualizarPaquete(paqueteId, { avisadoEn: new Date(), avisadoPorId: actor.id });
    await this.evento(envio.id, actor, 'AVISO', 'Aviso de llegada enviado por WhatsApp');
    return this.vista(await this.cargar(envio.id));
  }

  async cerrarRecepcion(actor: Actor, envioId: string): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    const pendientes = envio.paquetes.filter((p) => p.estado === 'ESPERADO');
    const recibidos = envio.paquetes.filter((p) => p.estado === 'RECIBIDO');
    if (recibidos.length === 0) throw AppError.badRequest('Aún no ha llegado ningún paquete de este envío.');
    if (!['RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'].includes(envio.estado)) {
      throw AppError.badRequest('Este envío ya no admite cerrar la recepción.');
    }
    if (pendientes.length > 0) {
      const nuevo = await this.repos.envios.crear({
        clienteId: envio.clienteId,
        modalidad: envio.modalidad,
        transportista: envio.transportista,
        tienda: envio.tienda,
        valorDeclaradoCentavos: 0,
        paquetes: [],
      });
      await this.repos.envios.moverPaquetes(pendientes.map((p) => p.id), nuevo.id);
      await this.evento(nuevo.id, actor, 'DIVISION', 'Paquetes pendientes separados de otro envío; falta el valor declarado');
      logger.info('Envío dividido al cerrar recepción', { original: envio.id, nuevo: nuevo.id });
    }
    let actual = await this.cargar(envio.id);
    if (actual.estado === 'RECIBIDO_PARCIAL') {
      validarTransicion(actual.estado, 'RECIBIDO_COMPLETO');
      actual = await this.repos.envios.actualizar(envio.id, { estado: 'RECIBIDO_COMPLETO' });
    }
    await this.evento(envio.id, actor, 'CIERRE_RECEPCION', 'Recepción cerrada para pasar al pago');
    return this.vista(await this.recalcular(actual));
  }

  async guardarEntrega(actor: Actor, envioId: string, datos: DatosEntrega): Promise<EnvioVista> {
    const envio = await this.obtenerEnvio(actor, envioId);
    if (['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)) {
      throw AppError.badRequest('El envío ya salió; los datos de entrega no se pueden cambiar.', 'ENVIO_BLOQUEADO');
    }
    const campo = (valor: unknown, nombre: string): string => {
      const limpio = limpiarTexto(valor, 120);
      if (!limpio) throw AppError.badRequest(`Falta ${nombre}.`);
      return limpio;
    };
    const actualizado = await this.repos.envios.actualizar(envioId, {
      entrega: {
        nombre: campo(datos.nombre, 'el nombre de quien recibe'),
        cedulaCifrada: this.cifrado.cifrar(validarCedula(String(datos.cedula ?? ''))),
        telefono: validarTelefono(String(datos.telefono ?? '')),
        agencia: campo(datos.agencia, 'la agencia de retiro'),
        ciudad: campo(datos.ciudad, 'la ciudad'),
        estado: campo(datos.estado, 'el estado'),
      },
    });
    await this.evento(envioId, actor, 'ENTREGA', 'Datos de entrega guardados');
    return this.vista(actualizado);
  }

  async despachar(actor: Actor, envioId: string, guia: string, foto?: ArchivoEntrada): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const envio = await this.cargar(envioId);
    const entrega: DatosEntrega = {
      nombre: envio.entrega.nombre,
      cedula: envio.entrega.cedulaCifrada ? '*' : null,
      telefono: envio.entrega.telefono,
      agencia: envio.entrega.agencia,
      ciudad: envio.entrega.ciudad,
      estado: envio.entrega.estado,
    };
    validarDespacho({ estado: envio.estado, pagoConfirmado: envio.estado === 'PAGADO', entrega });
    const numeroGuia = limpiarTexto(guia, 40);
    if (numeroGuia.length < 3) throw AppError.badRequest('Escribe el número de guía de la transportista.');
    let guiaFotoPath: string | null = null;
    if (foto) {
      const valida = validarImagen(foto);
      guiaFotoPath = rutaArchivo('guias', envioId, valida.mime);
      await this.almacenamiento.subir(guiaFotoPath, valida);
    }
    validarTransicion(envio.estado, 'DESPACHADO');
    const actualizado = await this.repos.envios.actualizar(envioId, {
      estado: 'DESPACHADO',
      guiaVenezolana: numeroGuia,
      guiaFotoPath,
    });
    await this.evento(envioId, actor, 'DESPACHO', `Despachado con ${envio.transportista}`);
    logger.info('Envío despachado', { envio: envioId, transportista: envio.transportista });
    return this.vista(actualizado);
  }

  async cerrar(actor: Actor, envioId: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const envio = await this.cargar(envioId);
    validarTransicion(envio.estado, 'CERRADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'CERRADO' });
    await this.evento(envioId, actor, 'CIERRE', 'Envío cerrado');
    return this.vista(actualizado);
  }

  async cancelar(actor: Actor, envioId: string, motivo: string): Promise<EnvioVista> {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const envio = await this.cargar(envioId);
    validarTransicion(envio.estado, 'CANCELADO');
    const actualizado = await this.repos.envios.actualizar(envioId, { estado: 'CANCELADO' });
    await this.evento(envioId, actor, 'CANCELACION', limpiarTexto(motivo, 200) || 'Cancelado');
    return this.vista(actualizado);
  }

  async ajusteAdmin(
    actor: Actor,
    envioId: string,
    cambios: { pesoTotalKg?: number; valorDeclaradoUsd?: number; totalUsd?: number; motivo: string },
  ): Promise<EnvioVista> {
    if (actor.rol !== 'ADMIN') throw AppError.forbidden('Solo el administrador puede corregir precios.');
    const motivo = limpiarTexto(cambios.motivo, 200);
    if (motivo.length < 5) throw AppError.badRequest('Escribe el motivo del ajuste (mínimo 5 letras).');
    const envio = await this.cargar(envioId);
    if (['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)) {
      throw AppError.badRequest('El envío ya salió; no se puede ajustar.', 'ENVIO_BLOQUEADO');
    }
    const anterior = {
      pesoTotalCentesimas: envio.pesoTotalCentesimas,
      valorDeclaradoCentavos: envio.valorDeclaradoCentavos,
      totalCentavos: envio.totalCentavos,
    };
    let trabajo = envio;
    if (cambios.valorDeclaradoUsd !== undefined) {
      trabajo = await this.repos.envios.actualizar(envioId, { valorDeclaradoCentavos: validarValorDeclarado(cambios.valorDeclaradoUsd) });
    }
    if (cambios.pesoTotalKg !== undefined) {
      const centesimas = kilosACentesimas(validarPesoKg(cambios.pesoTotalKg));
      const precio = calcularPrecio(trabajo.modalidad, centesimas, trabajo.valorDeclaradoCentavos, await this.config.tarifas());
      trabajo = await this.repos.envios.actualizar(envioId, {
        pesoTotalCentesimas: centesimas,
        pesoCobrableCentesimas: precio.pesoCobrableCentesimas,
        fleteCentavos: precio.fleteCentavos,
        seguroCentavos: precio.seguroCentavos,
        totalCentavos: precio.totalCentavos,
      });
    } else if (cambios.valorDeclaradoUsd !== undefined) {
      trabajo = await this.recalcular(trabajo);
    }
    if (cambios.totalUsd !== undefined) {
      if (!Number.isFinite(cambios.totalUsd) || cambios.totalUsd < 0) throw AppError.badRequest('El total no puede ser negativo.');
      trabajo = await this.repos.envios.actualizar(envioId, { totalCentavos: Math.round(cambios.totalUsd * 100) });
    }
    await this.evento(envioId, actor, 'AJUSTE', motivo, { anterior, nuevo: { ...cambios, motivo: undefined } });
    logger.info('Ajuste manual aplicado', { envio: envioId, actor: actor.id });
    return this.vista(trabajo);
  }

  async resumen(actor: Actor) {
    if (!esPersonal(actor)) throw AppError.forbidden();
    const envios = await this.repos.envios.listar({});
    const pagosPorConfirmar = await this.repos.pagos.porEstado('POR_CONFIRMAR');
    const activos = envios.filter((e) => !['CERRADO', 'CANCELADO'].includes(e.estado));
    return {
      porRecibir: activos.filter((e) => ['PREALERTADO', 'RECIBIDO_PARCIAL'].includes(e.estado)).reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'ESPERADO').length, 0),
      porAvisar: activos.reduce((s, e) => s + e.paquetes.filter((p) => p.estado === 'RECIBIDO' && !p.avisadoEn).length, 0),
      porCobrar: activos.filter((e) => e.estado === 'RECIBIDO_COMPLETO').length,
      pagosPorConfirmar: pagosPorConfirmar.length,
      porDespachar: activos.filter((e) => e.estado === 'PAGADO').length,
      sinAsignar: activos.filter((e) => e.tienda === 'Sin prealerta').length,
    };
  }

  async verArchivo(actor: Actor, ruta: string) {
    const partes = ruta.split('/');
    if (partes.length !== 3 || partes.some((p) => !p || p === '..')) throw AppError.notFound('El archivo no existe.');
    const envio = await this.cargar(partes[1]!);
    this.exigirAcceso(actor, envio);
    return this.almacenamiento.acceso(ruta);
  }
}
