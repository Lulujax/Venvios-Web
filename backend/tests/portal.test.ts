import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, datosCliente, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function crearPersonal(rol: 'OPERADOR' | 'ADMIN') {
  const datos = datosCliente({ nombre: rol === 'ADMIN' ? 'Ada Administradora' : 'Omar Operador' });
  await entorno.contexto.auth.crearPersonal({ ...datos, rol }, 'prueba');
  return datos;
}

describe('entrada única (RF-120)', () => {
  it('caso feliz: cliente, operador y administrador entran por la misma ruta y cada uno recibe su rol', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const cliente = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(cliente.status).toBe(200);
    expect(cliente.body.usuario.rol).toBe('CLIENTE');
    const op = await crearPersonal('OPERADOR');
    const operador = await entorno.agente().post('/api/auth/login').send({ identificador: op.email, contrasena: op.contrasena });
    expect(operador.status).toBe(200);
    expect(operador.body.usuario.rol).toBe('OPERADOR');
    const ad = await crearPersonal('ADMIN');
    const admin = await entorno.agente().post('/api/auth/login').send({ identificador: ad.email, contrasena: ad.contrasena });
    expect(admin.status).toBe(200);
    expect(admin.body.usuario.rol).toBe('ADMIN');
  });

  it('límite: un cliente sigue sin acceso a las rutas del personal aunque haya entrado por la misma puerta', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const agente = entorno.agente();
    await agente.post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect((await agente.get('/api/staff/clientes')).status).toBe(403);
    expect((await agente.get('/api/admin/usuarios')).status).toBe(403);
  });

  it('límite: un campo «portal» viejo se ignora y no cambia el resultado', async () => {
    const op = await crearPersonal('OPERADOR');
    const r = await entorno.agente().post('/api/auth/login').send({ identificador: op.email, contrasena: op.contrasena, portal: 'CLIENTE' });
    expect(r.status).toBe(200);
  });

  it('error: una contraseña mala da el mismo mensaje para cliente, personal y cuenta inexistente, sin abrir sesión', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const op = await crearPersonal('OPERADOR');
    const mensajes = new Set<string>();
    for (const identificador of [datos.email, op.email, 'nadie@correo.com']) {
      const r = await entorno.agente().post('/api/auth/login').send({ identificador, contrasena: 'Mala2026!' });
      expect(r.status).toBe(401);
      expect(r.headers['set-cookie']).toBeUndefined();
      mensajes.add(r.body.error.mensaje);
    }
    expect(mensajes.size).toBe(1);
  });
});
