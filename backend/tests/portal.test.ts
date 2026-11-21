import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, datosCliente, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function personal() {
  const datos = datosCliente({ nombre: 'Omar Operador' });
  await entorno.contexto.auth.crearPersonal({ ...datos, rol: 'OPERADOR' }, 'prueba');
  return datos;
}

describe('entradas separadas', () => {
  it('caso feliz: el cliente entra por la de clientes y el personal por /admin', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const cliente = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(cliente.status).toBe(200);
    const op = await personal();
    const operador = await entorno.agente().post('/api/auth/login').send({ identificador: op.email, contrasena: op.contrasena, portal: 'PERSONAL' });
    expect(operador.status).toBe(200);
  });

  it('error: el cliente no entra por /admin y el personal no entra por la de clientes, sin abrir sesión', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const agenteCliente = entorno.agente();
    const cliente = await agenteCliente.post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena, portal: 'PERSONAL' });
    expect(cliente.status).toBe(403);
    expect(cliente.body.error.mensaje).toContain('/ingresar');
    expect(cliente.headers['set-cookie']).toBeUndefined();
    const op = await personal();
    const operador = await entorno.agente().post('/api/auth/login').send({ identificador: op.email, contrasena: op.contrasena });
    expect(operador.status).toBe(403);
    expect(operador.body.error.mensaje).toContain('/admin');
  });

  it('límite: una contraseña mala por /admin sigue diciendo solo «incorrectos», sin revelar el tipo de cuenta', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: 'Mala2026!', portal: 'PERSONAL' });
    expect(r.status).toBe(401);
    expect(r.body.error.mensaje).not.toContain('personal');
  });

  it('error: un portal desconocido se rechaza', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena, portal: 'OTRO' });
    expect(r.status).toBe(400);
  });
});
