import { beforeEach, describe, expect, it } from 'vitest';
import { BLOQUEO_PERSONAL_MS, LimitadorIntentos } from '../src/services/AuthService';
import { crearRepositoriosMemoria } from '../src/repositories/memoria';
import { crearEntorno, crearPersonalYEntrar, datosCliente, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function crearPersonalConDatos(datos: ReturnType<typeof datosCliente>, rol: 'OPERADOR' | 'ADMIN' = 'OPERADOR') {
  return entorno.contexto.auth.crearPersonal({ ...datos, rol }, 'prueba');
}

describe('mismo dato en los dos mundos (RF-5, RF-6, RF-7)', () => {
  it('caso feliz: un cliente puede tener también una cuenta de operador con los mismos datos y entrar a las dos', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const operador = await crearPersonalConDatos(datos);
    expect(operador.rol).toBe('OPERADOR');

    const comoCliente = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    const comoPersonal = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(comoCliente.status).toBe(200);
    expect(comoCliente.body.usuario.rol).toBe('CLIENTE');
    expect(comoPersonal.status).toBe(200);
    expect(comoPersonal.body.usuario.rol).toBe('OPERADOR');
    expect(comoCliente.body.usuario.id).not.toBe(comoPersonal.body.usuario.id);
  });

  it('caso feliz: alguien que ya es personal puede registrarse después como cliente con los mismos datos', async () => {
    const datos = datosCliente({ nombre: 'Luis Doble' });
    await crearPersonalConDatos(datos, 'ADMIN');
    const registro = await entorno.agente().post('/api/auth/registro').send(datos);
    expect(registro.status).toBe(201);
    expect(registro.body.usuario.rol).toBe('CLIENTE');
  });

  it('caso feliz: el administrador crea el operador desde el panel con datos que ya existen como cliente', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const creado = await admin.agente.post('/api/admin/usuarios').send({ ...datos, rol: 'OPERADOR' });
    expect(creado.status).toBe(201);
  });

  it('error: repetir los datos dentro del mismo mundo sigue bloqueado', async () => {
    const datos = datosCliente();
    await crearPersonalConDatos(datos);
    await expect(crearPersonalConDatos(datos, 'ADMIN')).rejects.toThrow(/Ya existe una cuenta/);
    const { datos: datosCli } = await registrarCliente(entorno, {}, { conPerfil: false });
    const repetido = await entorno.agente().post('/api/auth/registro').send(datosCli);
    expect(repetido.status).toBe(409);
  });
});

describe('cada login busca solo en su mundo (RF-3)', () => {
  it('un cliente no entra por el login del personal y el personal no entra por el de clientes', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const personal = datosCliente({ nombre: 'Omar Operador' });
    await crearPersonalConDatos(personal);

    const clientePorEquipo = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(clientePorEquipo.status).toBe(401);
    expect(clientePorEquipo.headers['set-cookie']).toBeUndefined();
    const personalPorClientes = await entorno.agente().post('/api/auth/login').send({ identificador: personal.email, contrasena: personal.contrasena });
    expect(personalPorClientes.status).toBe(401);
    expect(personalPorClientes.headers['set-cookie']).toBeUndefined();
  });

  it('el mensaje de error es el mismo para cuenta inexistente, mundo equivocado y clave mala', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const mensajes = new Set<string>();
    for (const ruta of ['/api/equipo/auth/login', '/api/auth/login']) {
      const r = await entorno.agente().post(ruta).send({ identificador: datos.email, contrasena: 'Mala2026!' });
      mensajes.add(r.body.error.mensaje);
    }
    const inexistente = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: 'nadie@correo.com', contrasena: 'Mala2026!' });
    mensajes.add(inexistente.body.error.mensaje);
    expect(mensajes.size).toBe(1);
  });
});

describe('las sesiones no se cruzan (RF-4, RF-9, RF-12)', () => {
  it('la sesión de cliente no abre las rutas del personal ni la administración', async () => {
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    expect((await agente.get('/api/staff/clientes')).status).toBe(401);
    expect((await agente.get('/api/admin/usuarios')).status).toBe(401);
  });

  it('la sesión del personal no abre las rutas exclusivas de clientes', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.agente.get('/api/perfil')).status).toBe(401);
  });

  it('un operador no entra a la administración', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.agente.get('/api/admin/usuarios')).status).toBe(403);
  });

  it('una sesión de cliente copiada en la cookie del personal se rechaza', async () => {
    const registro = await entorno.agente().post('/api/auth/registro').send(datosCliente());
    const tokenCliente = /venvios_sesion=([^;]+)/.exec(String(registro.headers['set-cookie']))?.[1];
    expect(tokenCliente, 'no se encontró la cookie del cliente').toBeDefined();
    const intruso = await entorno.agente().get('/api/staff/clientes').set('Cookie', `venvios_equipo=${tokenCliente}`);
    expect(intruso.status).toBe(401);
  });

  it('un cliente que se atribuye el rol de administrador con una llave propia no entra', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { usuario } = await registrarCliente(entorno, {}, { conPerfil: false });
    for (const secreto of ['secreto-de-pruebas-1234567890', 'otra-llave-cualquiera-1234567890']) {
      const falso = jwt.sign({ sub: usuario.id, rol: 'ADMIN', v: 0, amb: 'PERSONAL' }, secreto);
      const r = await entorno.agente().get('/api/admin/usuarios').set('Cookie', `venvios_equipo=${falso}`);
      expect(r.status).toBe(401);
    }
  });

  it('una persona con las dos cuentas abiertas en el mismo navegador usa cada una según el acceso', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    await crearPersonalConDatos(datos);
    const agente = entorno.agente();
    await agente.post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    await agente.post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    const comoCliente = await agente.get('/api/auth/yo').set('x-ambito', 'cliente');
    const comoEquipo = await agente.get('/api/auth/yo').set('x-ambito', 'equipo');
    expect(comoCliente.body.usuario.rol).toBe('CLIENTE');
    expect(comoEquipo.body.usuario.rol).toBe('OPERADOR');
    expect((await agente.get('/api/staff/clientes')).status).toBe(200);
  });

  it('cerrar sesión en un mundo no cierra la del otro', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    await crearPersonalConDatos(datos);
    const agente = entorno.agente();
    await agente.post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    await agente.post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    await agente.post('/api/auth/logout').set('x-ambito', 'equipo');
    expect((await agente.get('/api/staff/clientes')).status).toBe(401);
    expect((await agente.get('/api/auth/yo').set('x-ambito', 'cliente')).status).toBe(200);
  });
});

describe('reglas del personal (RF-8)', () => {
  it('tras 5 fallos seguidos el login del personal se bloquea', async () => {
    const datos = datosCliente({ nombre: 'Omar Operador' });
    await crearPersonalConDatos(datos);
    for (let i = 0; i < 5; i += 1) {
      const fallo = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: 'incorrecta1' });
      expect(fallo.status).toBe(401);
    }
    const bloqueado = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(bloqueado.status).toBe(429);
  });

  it('los fallos en el login del personal no bloquean al cliente con el mismo correo', async () => {
    const { datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    await crearPersonalConDatos(datos);
    for (let i = 0; i < 5; i += 1) await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: 'incorrecta1' });
    const comoCliente = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(comoCliente.status).toBe(200);
  });

  it('el bloqueo del personal dura 3 minutos y después deja intentar de nuevo', async () => {
    expect(BLOQUEO_PERSONAL_MS).toBe(3 * 60 * 1000);
    const repos = crearRepositoriosMemoria();
    let ahora = 1_000_000;
    const limitador = new LimitadorIntentos(repos.intentos, () => ahora, 5, BLOQUEO_PERSONAL_MS);
    for (let i = 0; i < 5; i += 1) await limitador.registrarFallo('clave');
    await expect(limitador.verificar('clave')).rejects.toThrow();
    ahora += BLOQUEO_PERSONAL_MS - 1;
    await expect(limitador.verificar('clave')).rejects.toThrow();
    ahora += 2;
    await expect(limitador.verificar('clave')).resolves.toBeUndefined();
  });

  it('error: un limitador sin intentos o sin tiempo de bloqueo no se puede crear', () => {
    const repos = crearRepositoriosMemoria();
    expect(() => new LimitadorIntentos(repos.intentos, undefined, 0, 1000)).toThrow();
    expect(() => new LimitadorIntentos(repos.intentos, undefined, 5, 0)).toThrow();
  });

  it('la cookie de sesión del personal dura 8 horas y la del cliente 7 días', async () => {
    const datos = datosCliente({ nombre: 'Omar Operador' });
    await crearPersonalConDatos(datos);
    const personal = await entorno.agente().post('/api/equipo/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    const cookiePersonal = String(personal.headers['set-cookie']);
    expect(cookiePersonal).toContain('venvios_equipo=');
    expect(cookiePersonal).toContain('Max-Age=28800');
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    const cliente = await agente.get('/api/auth/yo');
    expect(cliente.status).toBe(200);
    const login = await entorno.agente().post('/api/auth/login').send({ identificador: (await agente.get('/api/auth/yo')).body.usuario.email, contrasena: 'ClavePrueba2026!' });
    expect(String(login.headers['set-cookie'])).toContain('Max-Age=604800');
  });
});
