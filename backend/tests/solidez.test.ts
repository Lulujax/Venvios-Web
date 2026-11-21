import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';
import { CifradoCedula } from '../src/domain/cifrado';
import { crearRepositoriosMemoria } from '../src/repositories/memoria';
import { LIMITE_LISTA_PERSONAL } from '../src/services/EnvioService';
import { TasaService } from '../src/services/TasaService';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

type Agente = Awaited<ReturnType<typeof registrarCliente>>['agente'];

async function prealertar(agente: Agente, trackings: string[]) {
  const r = await agente.post('/api/envios').send({ trackings, tienda: 'Shein', valorDeclaradoUsd: 0 });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body.envio as { id: string; paquetes: Array<{ id: string }> };
}

async function recibir(operador: Agente, trackings: string[]) {
  for (const texto of trackings) await operador.post('/api/staff/escaneo').send({ texto });
}

async function cotizado(referenciaCliente?: Awaited<ReturnType<typeof registrarCliente>>) {
  const cliente = referenciaCliente ?? (await registrarCliente(entorno));
  const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
  const tracking = `SOL-${Math.floor(Math.random() * 1e9)}`;
  const alerta = await prealertar(cliente.agente, [tracking]);
  await recibir(operador.agente, [tracking]);
  const c = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.paquetes[0]!.id], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 0 });
  const q = await operador.agente.post(`/api/staff/envios/${c.body.envio.id}/cotizar`).send({ pesoKg: 4 });
  return { cliente, operador: operador.agente, envioId: c.body.envio.id as string, total: q.body.envio.precio.totalCentavos as number };
}

function pagar(agente: Agente, envioId: string, monto: number, referencia: string) {
  return agente
    .post(`/api/envios/${envioId}/pagos`)
    .field('metodo', 'BINANCE')
    .field('moneda', 'USD')
    .field('monto', (monto / 100).toFixed(2))
    .field('referencia', referencia)
    .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
}

describe('clave temporal y sesiones', () => {
  it('error: un operador no puede poner clave temporal a un administrador', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const yo = await admin.agente.get('/api/auth/yo');
    const r = await operador.agente.post(`/api/staff/clientes/${yo.body.usuario.id}/clave-temporal`);
    expect(r.status).toBe(403);
    expect((await admin.agente.get('/api/auth/yo')).status).toBe(200);
  });

  it('caso feliz: un administrador sí puede ponerla a un operador', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const yo = await operador.agente.get('/api/auth/yo');
    expect((await admin.agente.post(`/api/staff/clientes/${yo.body.usuario.id}/clave-temporal`)).status).toBe(200);
  });

  it('la clave temporal cierra la sesión que ya estaba abierta', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await cliente.agente.get('/api/auth/yo')).status).toBe(200);
    await operador.agente.post(`/api/staff/clientes/${cliente.usuario.id}/clave-temporal`);
    expect((await cliente.agente.get('/api/auth/yo')).status).toBe(401);
  });

  it('cambiar la contraseña cierra otras sesiones pero mantiene la actual', async () => {
    const cliente = await registrarCliente(entorno);
    const otra = entorno.agente();
    await otra.post('/api/auth/login').send({ identificador: cliente.datos.email, contrasena: cliente.datos.contrasena });
    const cambio = await cliente.agente.post('/api/auth/cambiar-clave').send({ actual: cliente.datos.contrasena, nueva: 'NuevaClave2026!' });
    expect(cambio.status).toBe(200);
    expect((await cliente.agente.get('/api/auth/yo')).status).toBe(200);
    expect((await otra.get('/api/auth/yo')).status).toBe(401);
  });

  it('desactivar una cuenta la deja sin sesión', async () => {
    const cliente = await registrarCliente(entorno);
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    await admin.agente.patch(`/api/admin/usuarios/${cliente.usuario.id}`).send({ activo: false });
    expect((await cliente.agente.get('/api/auth/yo')).status).toBe(401);
  });
});

describe('intentos de ingreso guardados', () => {
  it('el bloqueo sigue aunque se cree otro servicio con el mismo repositorio', async () => {
    const { datos } = await registrarCliente(entorno);
    for (let i = 0; i < 5; i += 1) await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: 'incorrecta1' });
    const guardados = await entorno.contexto.repos.intentos.obtener(entorno.contexto.cifrado.huella(`acceso:${datos.email.toLowerCase()}`));
    expect(guardados?.cuenta).toBe(5);
  });

  it('límite: un ingreso correcto borra los fallos', async () => {
    const { datos } = await registrarCliente(entorno);
    await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: 'incorrecta1' });
    await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    const guardados = await entorno.contexto.repos.intentos.obtener(entorno.contexto.cifrado.huella(`acceso:${datos.email.toLowerCase()}`));
    expect(guardados).toBeNull();
  });
});

describe('cifrado', () => {
  it('la huella es HMAC: estable, distinta por llave y por texto', () => {
    const a = new CifradoCedula('a'.repeat(64));
    const b = new CifradoCedula('b'.repeat(64));
    expect(a.huella('12345678')).toBe(a.huella('12345678'));
    expect(a.huella('12345678')).not.toBe(b.huella('12345678'));
    expect(a.huella('12345678')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('los datos de entrega se guardan cifrados y se leen completos', async () => {
    const { cliente, operador, envioId } = await cotizado();
    const entrega = { nombre: 'Rosa Perez', cedula: '12345678', telefono: '584141234567', agencia: 'MRW Centro', ciudad: 'Caracas', estado: 'Distrito Capital' };
    const r = await operador.put(`/api/envios/${envioId}/entrega`).send(entrega);
    expect(r.status).toBe(200);
    expect(r.body.envio.entrega.nombre).toBe('Rosa Perez');
    expect(r.body.envio.entrega.telefono).toBe('584141234567');
    const crudo = await entorno.contexto.repos.envios.porId(envioId);
    expect(JSON.stringify(crudo?.entrega)).not.toContain('Rosa');
    expect(JSON.stringify(crudo?.entrega)).not.toContain('584141234567');
  });

  it('cifrarOpcional deja pasar el vacío', () => {
    const c = new CifradoCedula('a'.repeat(64));
    expect(c.cifrarOpcional(null)).toBeNull();
    expect(c.descifrarOpcional(c.cifrarOpcional('hola'))).toBe('hola');
  });
});

describe('cambios simultáneos', () => {
  it('confirmar dos veces el mismo pago aplica solo la primera', async () => {
    const { cliente, operador, envioId, total } = await cotizado();
    const subido = await pagar(cliente.agente, envioId, total, 'BIN111222111222');
    const pagoId = subido.body.envio.pagos[0].id as string;
    const [a, b] = await Promise.all([operador.post(`/api/staff/pagos/${pagoId}/confirmar`), operador.post(`/api/staff/pagos/${pagoId}/confirmar`)]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const detalle = await operador.get(`/api/envios/${envioId}`);
    expect(detalle.body.envio.pagadoCentavos).toBe(total);
  });

  it('escanear dos veces a la vez el mismo paquete lo recibe una sola vez', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    await prealertar(cliente.agente, ['DOB-998877']);
    const [a, b] = await Promise.all([
      operador.agente.post('/api/staff/escaneo').send({ texto: 'DOB-998877' }),
      operador.agente.post('/api/staff/escaneo').send({ texto: 'DOB-998877' }),
    ]);
    const resultados = [a.body.resultado, b.body.resultado].sort();
    expect(resultados).toEqual(['RECIBIDO', 'YA_REGISTRADO']);
  });
});

describe('transacciones', () => {
  it('si algo falla a la mitad, la memoria vuelve a como estaba', async () => {
    const repos = crearRepositoriosMemoria();
    const base = { clienteId: 'c', modalidad: 'M1' as const, transportista: 'MRW' as const, tienda: 'x', valorDeclaradoCentavos: 0, paquetes: [] };
    await expect(
      repos.enTransaccion(async () => {
        await repos.envios.crear(base);
        throw new Error('falla a la mitad');
      }),
    ).rejects.toThrow('falla a la mitad');
    expect(await repos.envios.listar({})).toHaveLength(0);
  });

  it('caso feliz: lo guardado dentro de la transacción queda', async () => {
    const repos = crearRepositoriosMemoria();
    await repos.enTransaccion(async () => {
      await repos.envios.crear({ clienteId: 'c', modalidad: 'M1', transportista: 'MRW', tienda: 'x', valorDeclaradoCentavos: 0, paquetes: [] });
    });
    expect(await repos.envios.listar({})).toHaveLength(1);
  });

  it('un error en la ruta no deja el envío del consolidado a medias', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['TX-445566']);
    await recibir(operador.agente, ['TX-445566']);
    const antes = (await entorno.contexto.repos.envios.listar({})).length;
    const r = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [alerta.paquetes[0]!.id, 'no-existe'], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 0 });
    expect(r.status).toBe(404);
    expect((await entorno.contexto.repos.envios.listar({})).length).toBe(antes);
  });
});

describe('muchos envíos', () => {
  it('encuentra y asigna el paquete más viejo aunque haya más de 200 envíos', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const primero = await operador.agente.post('/api/staff/sin-prealerta').send({ texto: 'VIEJO-0001' });
    const paqueteViejo = primero.body.envio.paquetes[0].id as string;
    for (let i = 0; i < LIMITE_LISTA_PERSONAL + 20; i += 1) {
      await entorno.contexto.repos.envios.crear({ clienteId: cliente.usuario.id, modalidad: 'M1', transportista: 'MRW', tienda: 'x', valorDeclaradoCentavos: 0, paquetes: [] });
    }
    const r = await operador.agente.post(`/api/staff/paquetes/${paqueteViejo}/asignar`).send({ clienteId: cliente.usuario.id });
    expect(r.status).toBe(200);
  });

  it('la lista del personal muestra 200 pero el buscador encuentra los más antiguos', async () => {
    const cliente = await registrarCliente(entorno, { nombre: 'Zacarias Unico' });
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    await prealertar(cliente.agente, ['ANTIGUO-777']);
    for (let i = 0; i < LIMITE_LISTA_PERSONAL + 5; i += 1) {
      await entorno.contexto.repos.envios.crear({ clienteId: cliente.usuario.id, modalidad: 'M1', transportista: 'MRW', tienda: 'x', valorDeclaradoCentavos: 0, paquetes: [] });
    }
    const lista = await operador.agente.get('/api/envios');
    expect(lista.body.envios).toHaveLength(LIMITE_LISTA_PERSONAL);
    const buscada = await operador.agente.get('/api/envios?q=ANTIGUO-777');
    expect(buscada.body.envios).toHaveLength(1);
  });

  it('la foto de un paquete se sirve a su dueño aunque haya muchos envíos', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['FOT-123123']);
    await recibir(operador.agente, ['FOT-123123']);
    const subida = await operador.agente.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/foto`).attach('archivo', PNG_MINIMO, { filename: 'f.png', contentType: 'image/png' });
    const ruta = subida.body.envio.paquetes[0].fotoRuta as string;
    expect((await cliente.agente.get(`/api/archivos/${ruta}`)).status).toBe(200);
    const ajeno = await registrarCliente(entorno);
    expect((await ajeno.agente.get(`/api/archivos/${ruta}`)).status).toBe(404);
  });
});

describe('tasa BCV en caché', () => {
  it('consulta la fuente una sola vez para varias lecturas seguidas', async () => {
    let llamadas = 0;
    const repos = crearRepositoriosMemoria();
    const tasas = new TasaService(repos.config, async () => {
      llamadas += 1;
      return 900;
    });
    await Promise.all([tasas.vigente(), tasas.vigente(), tasas.vigente()]);
    await tasas.vigente();
    expect(llamadas).toBe(1);
  });

  it('si la fuente falla, no se vuelve a esperar en cada lectura', async () => {
    let llamadas = 0;
    const repos = crearRepositoriosMemoria();
    await repos.config.guardarTasa({ fecha: '2020-01-01', bolivaresPorUsd: 40, fuente: 'MANUAL' });
    const tasas = new TasaService(repos.config, async () => {
      llamadas += 1;
      throw new Error('caída');
    });
    const uno = await tasas.vigente();
    await tasas.vigente();
    expect(uno.desactualizada).toBe(true);
    expect(llamadas).toBe(1);
  });

  it('error: sin ninguna tasa guardada y con la fuente caída, avisa', async () => {
    const repos = crearRepositoriosMemoria();
    const tasas = new TasaService(repos.config, async () => {
      throw new Error('caída');
    });
    await expect(tasas.vigente()).rejects.toThrow(/No hay tasa/);
  });

  it('cargar una tasa a mano reemplaza la del caché', async () => {
    const repos = crearRepositoriosMemoria();
    const tasas = new TasaService(repos.config, async () => 900);
    expect((await tasas.vigente()).bolivaresPorUsd).toBe(900);
    await tasas.cargarManual(950, 'admin');
    expect((await tasas.vigente()).bolivaresPorUsd).toBe(950);
  });
});

describe('arranque en producción', () => {
  it('se niega a arrancar sin almacén de fotos', async () => {
    const { crearContextoDesdeEntorno } = await import('../src/config/contexto');
    const guardado = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.CEDULA_KEY = 'a'.repeat(64);
    process.env.DATABASE_URL = '';
    delete process.env.SUPABASE_URL;
    delete process.env.NETLIFY;
    try {
      await expect(crearContextoDesdeEntorno()).rejects.toThrow(/DATABASE_URL|SUPABASE_URL/);
    } finally {
      process.env = guardado;
    }
  });
});
