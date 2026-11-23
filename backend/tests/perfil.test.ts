import { beforeEach, describe, expect, it } from 'vitest';
import { ENTREGA_PERFIL_PRUEBA, PNG_MINIMO, crearEntorno, crearPersonalYEntrar, datosCliente, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

type Agente = Awaited<ReturnType<typeof registrarCliente>>['agente'];

async function paqueteEnBodega(cliente: Agente, operador: Agente): Promise<string> {
  const tracking = `PER-${Math.floor(Math.random() * 1e9)}`;
  const alerta = await cliente.post('/api/envios').send({ trackings: [tracking], tienda: 'Shein', valorDeclaradoUsd: 10 });
  expect(alerta.status).toBe(201);
  await operador.post('/api/staff/escaneo').send({ texto: tracking });
  return alerta.body.envio.paquetes[0].id as string;
}

describe('perfil: mis datos', () => {
  it('caso feliz: el cliente cambia su nombre sin pedir contraseña', async () => {
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await agente.put('/api/perfil/datos').send({ nombre: 'Maria Fernanda Gonzalez' });
    expect(r.status).toBe(200);
    expect(r.body.datos.nombre).toBe('Maria Fernanda Gonzalez');
  });

  it('error: cambiar el correo o el teléfono pide la contraseña actual', async () => {
    const { agente, datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const sinClave = await agente.put('/api/perfil/datos').send({ email: 'nuevo@correo.com' });
    expect(sinClave.status).toBe(400);
    expect(sinClave.body.error.codigo).toBe('CONTRASENA_ACTUAL');
    const claveMala = await agente.put('/api/perfil/datos').send({ telefono: '573009998811', contrasenaActual: 'Incorrecta1!' });
    expect(claveMala.status).toBe(400);
    const bien = await agente.put('/api/perfil/datos').send({ email: 'nuevo@correo.com', contrasenaActual: datos.contrasena });
    expect(bien.status).toBe(200);
    expect(bien.body.datos.email).toBe('nuevo@correo.com');
  });

  it('error: un correo o teléfono que ya son de otra cuenta se rechazan', async () => {
    const otra = await registrarCliente(entorno, {}, { conPerfil: false });
    const { agente, datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const correo = await agente.put('/api/perfil/datos').send({ email: otra.datos.email, contrasenaActual: datos.contrasena });
    expect(correo.status).toBe(409);
    const telefono = await agente.put('/api/perfil/datos').send({ telefono: otra.datos.telefono, contrasenaActual: datos.contrasena });
    expect(telefono.status).toBe(409);
  });

  it('límite: la contraseña nueva cierra las sesiones de otros equipos y la actual sigue', async () => {
    const { agente, datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const otroEquipo = entorno.agente();
    await otroEquipo.post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect((await otroEquipo.get('/api/auth/yo')).status).toBe(200);
    const cambio = await agente.put('/api/perfil/datos').send({ contrasenaActual: datos.contrasena, contrasenaNueva: 'NuevaClave2026!' });
    expect(cambio.status).toBe(200);
    expect((await otroEquipo.get('/api/auth/yo')).status).toBe(401);
    expect((await agente.get('/api/auth/yo')).status).toBe(200);
    const debil = await agente.put('/api/perfil/datos').send({ contrasenaActual: 'NuevaClave2026!', contrasenaNueva: 'corta' });
    expect(debil.status).toBe(400);
  });

  it('error: el cliente no puede cambiar su cédula aunque la envíe', async () => {
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    const antes = (await agente.get('/api/perfil')).body.datos.cedulaEnmascarada as string;
    await agente.put('/api/perfil/datos').send({ nombre: 'Maria Gonzalez Perez', cedula: '99999999' });
    const despues = (await agente.get('/api/perfil')).body.datos.cedulaEnmascarada as string;
    expect(despues).toBe(antes);
  });

  it('error: el personal no entra a la sección de perfil del cliente', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.agente.get('/api/perfil')).status).toBe(401);
  });
});

describe('perfil: mis datos de entrega', () => {
  it('caso feliz: guarda MRW sin llenar Zoom y lo deja cifrado', async () => {
    const { agente, usuario } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await agente.put('/api/perfil/entrega').send({
      receptor: { nombre: 'Rosa Perez', cedula: '12345678', telefono: '584141234567' },
      MRW: ENTREGA_PERFIL_PRUEBA.MRW,
    });
    expect(r.status).toBe(200);
    expect(r.body.entrega.completo).toEqual({ MRW: true, ZOOM: false });
    expect(r.body.entrega.receptor.nombre).toBe('Rosa Perez');
    const crudo = await entorno.contexto.repos.usuarios.porId(usuario.id);
    expect(JSON.stringify(crudo?.perfilEntrega)).not.toContain('Rosa');
    expect(JSON.stringify(crudo?.perfilEntrega)).not.toContain('12345678');
    expect(JSON.stringify(crudo?.perfilEntrega)).not.toContain('584141234567');
  });

  it('límite: sin receptor usa los datos del propio cliente', async () => {
    const { agente, datos } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await agente.put('/api/perfil/entrega').send({ MRW: ENTREGA_PERFIL_PRUEBA.MRW });
    expect(r.body.entrega.receptor).toBeNull();
    expect(r.body.entrega.receptorPorDefecto.nombre).toBe(datos.nombre);
  });

  it('error: una transportista con datos a medias se rechaza', async () => {
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    const r = await agente.put('/api/perfil/entrega').send({ MRW: { agencia: 'MRW Chacao', ciudad: '', estado: '' } });
    expect(r.status).toBe(400);
    const receptor = await agente.put('/api/perfil/entrega').send({ receptor: { nombre: 'Rosa Perez', cedula: '12', telefono: '584141234567' } });
    expect(receptor.status).toBe(400);
  });

  it('dejar los tres campos vacíos borra esa transportista', async () => {
    const { agente } = await registrarCliente(entorno);
    const r = await agente.put('/api/perfil/entrega').send({ ZOOM: { agencia: '', ciudad: '', estado: '' } });
    expect(r.body.entrega.completo).toEqual({ MRW: true, ZOOM: false });
  });
});

describe('consolidar con los datos del perfil', () => {
  it('error: con el perfil incompleto el cliente no puede enviar la solicitud', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente } = await registrarCliente(entorno, {}, { conPerfil: false });
    const paqueteId = await paqueteEnBodega(agente, operador.agente);
    const r = await agente.post('/api/envios/consolidar').send({ paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('PERFIL_INCOMPLETO');
  });

  it('caso feliz: copia el perfil al envío y cambiar el perfil después no lo cambia', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente, datos } = await registrarCliente(entorno);
    const paqueteId = await paqueteEnBodega(agente, operador.agente);
    const creado = await agente.post('/api/envios/consolidar').send({ paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 10 });
    expect(creado.status).toBe(201);
    const envioId = creado.body.envio.id as string;
    expect(creado.body.envio.entrega.agencia).toBe('MRW Chacao');
    expect(creado.body.envio.entrega.nombre).toBe(datos.nombre);

    await agente.put('/api/perfil/entrega').send({ MRW: { agencia: 'MRW Maracay', ciudad: 'Maracay', estado: 'Aragua' } });
    const igual = await agente.get(`/api/envios/${envioId}`);
    expect(igual.body.envio.entrega.agencia).toBe('MRW Chacao');

    const actualizado = await agente.post(`/api/envios/${envioId}/entrega/perfil`);
    expect(actualizado.status).toBe(200);
    expect(actualizado.body.envio.entrega.agencia).toBe('MRW Maracay');
  });

  it('el operador puede consolidar para un cliente sin perfil y corregir la entrega, pero el cliente no', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente, usuario } = await registrarCliente(entorno, {}, { conPerfil: false });
    const paqueteId = await paqueteEnBodega(agente, operador.agente);
    const creado = await operador.agente
      .post('/api/envios/consolidar')
      .send({ clienteId: usuario.id, paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 10 });
    expect(creado.status).toBe(201);
    expect(creado.body.envio.entrega.agencia).toBeNull();
    const envioId = creado.body.envio.id as string;

    const delCliente = await agente.put(`/api/envios/${envioId}/entrega`).send({ nombre: 'Maria Gonzalez', cedula: '12345678', telefono: '584141234567', agencia: 'MRW', ciudad: 'Caracas', estado: 'Miranda' });
    expect(delCliente.status).toBe(403);
    const delOperador = await operador.agente.put(`/api/envios/${envioId}/entrega`).send({ nombre: 'Maria Gonzalez', cedula: '12345678', telefono: '584141234567', agencia: 'MRW Sur', ciudad: 'Caracas', estado: 'Miranda' });
    expect(delOperador.status).toBe(200);
    expect(delOperador.body.envio.entrega.agencia).toBe('MRW Sur');
  });

  it('error: con el perfil sin datos de esa transportista no se actualiza el envío', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente, usuario } = await registrarCliente(entorno, {}, { conPerfil: false });
    const paqueteId = await paqueteEnBodega(agente, operador.agente);
    const creado = await operador.agente
      .post('/api/envios/consolidar')
      .send({ clienteId: usuario.id, paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 10 });
    const r = await agente.post(`/api/envios/${creado.body.envio.id}/entrega/perfil`);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('PERFIL_INCOMPLETO');
  });

  it('un envío sin entrega completa no se despacha aunque esté pagado', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const { agente, usuario } = await registrarCliente(entorno, {}, { conPerfil: false });
    const paqueteId = await paqueteEnBodega(agente, operador.agente);
    const creado = await operador.agente
      .post('/api/envios/consolidar')
      .send({ clienteId: usuario.id, paqueteIds: [paqueteId], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 0 });
    const envioId = creado.body.envio.id as string;
    const cotizado = await operador.agente.post(`/api/staff/envios/${envioId}/cotizar`).send({ pesoKg: 4 });
    const total = cotizado.body.envio.precio.totalCentavos as number;
    const pago = await agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', (total / 100).toFixed(2))
      .field('referencia', 'BIN112233112233')
      .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
    expect(pago.status).toBe(201);
    await operador.agente.post(`/api/staff/pagos/${pago.body.envio.pagos[0].id}/confirmar`);
    const despacho = await operador.agente.post(`/api/staff/envios/${envioId}/despachar`).field('guia', 'MRW123456');
    expect(despacho.body.error.codigo).toBe('DESPACHO_INCOMPLETO');
  });
});

describe('corrección de cédula por el administrador', () => {
  it('caso feliz: el administrador corrige con motivo y queda en el historial sin la cédula anterior completa', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const { agente, usuario, datos } = await registrarCliente(entorno, { cedula: '11223344' }, { conPerfil: false });
    const r = await admin.agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '55667788', motivo: 'Error al registrarse' });
    expect(r.status).toBe(200);
    expect(r.body.cliente.cedulaEnmascarada).toBe('V-***788');
    expect((await agente.get('/api/perfil')).body.datos.cedulaEnmascarada).toBe('V-***788');
    const viejaLibre = await entorno.agente().post('/api/auth/registro').send(datosCliente({ cedula: '11223344' }));
    expect(viejaLibre.status).toBe(201);
    const historial = await admin.agente.get(`/api/admin/clientes/${usuario.id}/historial`);
    const texto = JSON.stringify(historial.body);
    expect(historial.body.eventos[0].tipo).toBe('CEDULA_CORREGIDA');
    expect(texto).toContain('Error al registrarse');
    expect(texto).not.toContain('11223344');
    expect(texto).not.toContain('55667788');
    expect(datos.email).toBeDefined();
  });

  it('error: una cédula repetida, sin motivo, o de un operador o cliente no se cambia', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const otro = await registrarCliente(entorno, { cedula: '33445566' }, { conPerfil: false });
    const { agente, usuario } = await registrarCliente(entorno, { cedula: '11223344' }, { conPerfil: false });
    expect(otro.usuario.id).toBeDefined();
    const repetida = await admin.agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '33445566', motivo: 'Error al registrarse' });
    expect(repetida.status).toBe(409);
    const sinMotivo = await admin.agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '55667788', motivo: 'x' });
    expect(sinMotivo.status).toBe(400);
    const invalida = await admin.agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '12', motivo: 'Error al registrarse' });
    expect(invalida.status).toBe(400);
    expect((await operador.agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '55667788', motivo: 'Error al registrarse' })).status).toBe(403);
    expect((await agente.put(`/api/admin/clientes/${usuario.id}/cedula`).send({ cedula: '55667788', motivo: 'Error al registrarse' })).status).toBe(401);
    expect((await agente.get('/api/perfil')).body.datos.cedulaEnmascarada).toBe('V-***344');
  });
});
