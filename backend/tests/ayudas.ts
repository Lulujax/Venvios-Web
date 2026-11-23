import request from 'supertest';
import { crearContexto, type Contexto } from '../src/config/contexto';
import { crearApp } from '../src/http/app';
import { crearRepositoriosMemoria } from '../src/repositories/memoria';
import { AlmacenamientoMemoria } from '../src/services/Almacenamiento';
import type { CanalCodigo } from '../src/services/CanalCodigo';
import { sembrarConfiguracion } from '../src/services/Semilla';
import type { DatosPago } from '../src/config/predeterminados';

export const PNG_MINIMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export interface Entorno {
  contexto: Contexto;
  app: ReturnType<typeof crearApp>;
  agente: () => ReturnType<typeof request.agent>;
}

export async function crearEntorno(opciones: { consultaTasa?: () => Promise<number>; canalCodigo?: CanalCodigo } = {}): Promise<Entorno> {
  const contexto = crearContexto({
    repos: crearRepositoriosMemoria(),
    almacenamiento: new AlmacenamientoMemoria(),
    canalCodigo: opciones.canalCodigo,
    llaveCedula: 'c'.repeat(64),
    secretoJwt: 'secreto-de-pruebas-1234567890',
    urlApp: 'https://prueba.venvios.test',
    consultaTasa: opciones.consultaTasa ?? (async () => 900),
    reloj: () => new Date('2026-11-19T15:00:00Z'),
  });
  await sembrarConfiguracion(contexto);
  const datosPago = (await contexto.repos.config.obtener('datosPago')) as DatosPago;
  await contexto.repos.config.guardar('datosPago', { ...datosPago, binance: { ...datosPago.binance, activo: true } });
  const app = crearApp(contexto);
  return { contexto, app, agente: () => request.agent(app) };
}

let contadorTelefono = 0;

export function datosCliente(sobrescribir: Partial<Record<'nombre' | 'cedula' | 'email' | 'telefono' | 'contrasena', string>> = {}) {
  contadorTelefono += 1;
  return {
    nombre: 'Maria Gonzalez',
    cedula: String(20000000 + contadorTelefono),
    email: `cliente${contadorTelefono}@correo.com`,
    telefono: `5730012${String(30000 + contadorTelefono)}`,
    contrasena: 'ClavePrueba2026!',
    ...sobrescribir,
  };
}

export const ENTREGA_PERFIL_PRUEBA = {
  MRW: { agencia: 'MRW Chacao', ciudad: 'Caracas', estado: 'Miranda' },
  ZOOM: { agencia: 'Zoom Valencia Centro', ciudad: 'Valencia', estado: 'Carabobo' },
};

export async function registrarCliente(entorno: Entorno, sobrescribir = {}, opciones: { conPerfil?: boolean } = {}) {
  const agente = entorno.agente();
  const datos = datosCliente(sobrescribir);
  const respuesta = await agente.post('/api/auth/registro').send(datos);
  if (respuesta.status !== 201) throw new Error(`Registro falló: ${JSON.stringify(respuesta.body)}`);
  if (opciones.conPerfil !== false) {
    const perfil = await agente.put('/api/perfil/entrega').send(ENTREGA_PERFIL_PRUEBA);
    if (perfil.status !== 200) throw new Error(`Perfil falló: ${JSON.stringify(perfil.body)}`);
  }
  return { agente, datos, usuario: respuesta.body.usuario as { id: string } };
}

export async function crearPersonalYEntrar(entorno: Entorno, rol: 'OPERADOR' | 'ADMIN') {
  const datos = datosCliente({ nombre: rol === 'ADMIN' ? 'Ana Administradora' : 'Omar Operador' });
  await entorno.contexto.auth.crearPersonal({ ...datos, rol }, 'prueba');
  const agente = entorno.agente();
  const respuesta = await agente.post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
  if (respuesta.status !== 200) throw new Error(`Login falló: ${JSON.stringify(respuesta.body)}`);
  return { agente, datos };
}
