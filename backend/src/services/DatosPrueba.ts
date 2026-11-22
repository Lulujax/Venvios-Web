import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Contexto } from '../config/contexto';
import { ESTADOS_ENVIO, TIPOS_ENVIO, type EstadoEnvio } from '../domain/estados';
import { entregaDesdePerfil } from '../domain/perfil';
import { normalizarTracking } from '../domain/tracking';
import { logger } from '../utils/logger';

export const RUTA_DATOS_PRUEBA = path.resolve(__dirname, '../../datos-prueba/paquetes-prueba.json');
export const CONTRASENA_CLIENTES_PRUEBA = 'ClavePrueba2026!';

const esquemaDestino = z.object({
  agencia: z.string().min(2),
  ciudad: z.string().min(2),
  estado: z.string().min(2),
});

const esquemaCliente = z.object({
  clave: z.string().min(1),
  nombre: z.string().min(3),
  cedula: z.string().regex(/^\d{5,10}$/),
  email: z.string().email(),
  telefono: z.string().regex(/^\d{10,15}$/),
  entrega: z
    .object({ MRW: esquemaDestino.optional(), ZOOM: esquemaDestino.optional() })
    .optional(),
});

const esquemaPaquete = z.object({
  tracking: z.string().min(4).max(60),
  estado: z.enum(['ESPERADO', 'RECIBIDO']),
  pesoKg: z.number().positive().nullable(),
});

const esquemaEnvio = z.object({
  tipo: z.enum(TIPOS_ENVIO),
  cliente: z.string().min(1),
  modalidad: z.enum(['M1', 'M2']),
  transportista: z.enum(['MRW', 'ZOOM']),
  tienda: z.string().min(1),
  valorUsd: z.number().positive(),
  paquetes: z.array(esquemaPaquete).min(1),
});

const esquemaSeccion = z.object({
  estado: z.enum(ESTADOS_ENVIO),
  envios: z.array(esquemaEnvio),
});

const esquemaFixture = z
  .object({
    clientes: z.array(esquemaCliente).min(1),
    secciones: z.array(esquemaSeccion).min(1),
  })
  .superRefine((fixture, contexto) => {
    const claves = new Set(fixture.clientes.map((cliente) => cliente.clave));
    if (claves.size !== fixture.clientes.length) {
      contexto.addIssue({ code: 'custom', message: 'Hay claves de cliente repetidas.', path: ['clientes'] });
    }
    const trackings = new Set<string>();
    fixture.secciones.forEach((seccion, indiceSeccion) => {
      seccion.envios.forEach((envio, indiceEnvio) => {
        if (!claves.has(envio.cliente)) {
          contexto.addIssue({ code: 'custom', message: `Cliente desconocido: ${envio.cliente}`, path: ['secciones', indiceSeccion, 'envios', indiceEnvio, 'cliente'] });
        }
        envio.paquetes.forEach((paquete, indicePaquete) => {
          const trackingNormalizado = normalizarTracking(paquete.tracking);
          if (trackings.has(trackingNormalizado)) {
            contexto.addIssue({ code: 'custom', message: `Tracking repetido: ${paquete.tracking}`, path: ['secciones', indiceSeccion, 'envios', indiceEnvio, 'paquetes', indicePaquete] });
          }
          trackings.add(trackingNormalizado);
          const pesoEsperado = paquete.estado === 'RECIBIDO';
          if (pesoEsperado && paquete.pesoKg === null) {
            contexto.addIssue({ code: 'custom', message: `Un paquete recibido necesita peso: ${paquete.tracking}`, path: ['secciones', indiceSeccion, 'envios', indiceEnvio, 'paquetes', indicePaquete] });
          }
          if (!pesoEsperado && paquete.pesoKg !== null) {
            contexto.addIssue({ code: 'custom', message: `Un paquete esperado no lleva peso: ${paquete.tracking}`, path: ['secciones', indiceSeccion, 'envios', indiceEnvio, 'paquetes', indicePaquete] });
          }
        });
      });
    });
  });

export type FixtureDatosPrueba = z.infer<typeof esquemaFixture>;

export interface ResumenDatosPrueba {
  clientes: number;
  envios: number;
  paquetes: number;
}

export function validarFixture(datos: unknown): FixtureDatosPrueba {
  logger.info('Validando datos de prueba');
  const resultado = esquemaFixture.safeParse(datos);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    logger.error('Datos de prueba inválidos', { problemas: detalles.length });
    throw new Error(`Datos de prueba inválidos: ${detalles.join('; ')}`);
  }
  return resultado.data;
}

export function leerFixtureDatosPrueba(ruta: string = RUTA_DATOS_PRUEBA): FixtureDatosPrueba {
  logger.info('Leyendo datos de prueba', { archivo: path.basename(ruta) });
  let contenido: string;
  try {
    contenido = readFileSync(ruta, 'utf8');
  } catch (error) {
    logger.error('No se pudo leer el archivo de datos de prueba', { motivo: error instanceof Error ? error.message : 'desconocido' });
    throw new Error('No se encontró el archivo de datos de prueba.');
  }
  return validarFixture(JSON.parse(contenido));
}

export function verificarEntornoDePrueba(contexto: Contexto): void {
  if (contexto.produccion || process.env.DATABASE_URL) {
    logger.error('Se negó cargar datos de prueba: el entorno no es solo de memoria');
    throw new Error('Los datos de prueba solo se cargan con datos en memoria, nunca con base de datos ni en producción.');
  }
}

export async function cargarDatosDePrueba(contexto: Contexto, fixture: FixtureDatosPrueba): Promise<ResumenDatosPrueba> {
  verificarEntornoDePrueba(contexto);
  logger.info('Cargando datos de prueba', { clientes: fixture.clientes.length, secciones: fixture.secciones.length });
  const idsPorClave = await crearClientes(contexto, fixture);
  let envios = 0;
  let paquetes = 0;
  for (const seccion of fixture.secciones) {
    for (const envio of seccion.envios) {
      await crearEnvio(contexto, envio, seccion.estado, idsPorClave);
      envios += 1;
      paquetes += envio.paquetes.length;
    }
    logger.info('Sección de datos de prueba cargada', { estado: seccion.estado, envios: seccion.envios.length });
  }
  const resumen: ResumenDatosPrueba = { clientes: idsPorClave.size, envios, paquetes };
  logger.info('Datos de prueba cargados', { ...resumen });
  return resumen;
}

async function crearClientes(contexto: Contexto, fixture: FixtureDatosPrueba): Promise<Map<string, string>> {
  const idsPorClave = new Map<string, string>();
  for (const cliente of fixture.clientes) {
    const sesion = await contexto.auth.registrarCliente({
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      email: cliente.email,
      telefono: cliente.telefono,
      contrasena: CONTRASENA_CLIENTES_PRUEBA,
    });
    idsPorClave.set(cliente.clave, sesion.usuario.id);
    if (cliente.entrega) await contexto.perfil.guardarEntrega(sesion.usuario.id, cliente.entrega);
  }
  logger.info('Clientes de prueba creados', { cantidad: idsPorClave.size });
  return idsPorClave;
}

async function crearEnvio(
  contexto: Contexto,
  envio: FixtureDatosPrueba['secciones'][number]['envios'][number],
  estado: EstadoEnvio,
  idsPorClave: Map<string, string>,
): Promise<void> {
  const clienteId = idsPorClave.get(envio.cliente);
  if (!clienteId) throw new Error(`Cliente de prueba no cargado: ${envio.cliente}`);
  const creado = await contexto.repos.envios.crear({
    tipo: envio.tipo,
    estado,
    clienteId,
    modalidad: envio.modalidad,
    transportista: envio.transportista,
    tienda: envio.tienda,
    valorDeclaradoCentavos: Math.round(envio.valorUsd * 100),
    paquetes: envio.paquetes.map((paquete) => ({
      trackingTexto: paquete.tracking,
      trackingNormalizado: normalizarTracking(paquete.tracking),
    })),
  });
  if (envio.tipo === 'CONSOLIDADO') {
    const dueno = await contexto.repos.usuarios.porId(clienteId);
    const entrega = dueno ? entregaDesdePerfil(dueno, envio.transportista, contexto.cifrado) : null;
    if (entrega) await contexto.repos.envios.actualizar(creado.id, { entrega });
  }
  for (const [indice, paquete] of envio.paquetes.entries()) {
    if (paquete.estado !== 'RECIBIDO') continue;
    await contexto.repos.envios.actualizarPaquete(creado.paquetes[indice]!.id, {
      estado: 'RECIBIDO',
      pesoCentesimas: paquete.pesoKg === null ? null : Math.round(paquete.pesoKg * 100),
      recibidoEn: new Date(),
    });
  }
}
