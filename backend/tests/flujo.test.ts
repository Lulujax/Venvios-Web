import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, datosCliente, registrarCliente, type Entorno } from './ayudas';
import { CifradoCedula } from '../src/domain/cifrado';
import { crearRepositoriosMemoria } from '../src/repositories/memoria';
import { AuthService } from '../src/services/AuthService';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

async function prealertar(agente: Awaited<ReturnType<typeof registrarCliente>>['agente'], trackings: string[], extra: Record<string, unknown> = {}) {
  const respuesta = await agente.post('/api/envios').send({
    trackings,
    tienda: 'Shein',
    valorDeclaradoUsd: 60,
    modalidad: 'M1',
    transportista: 'MRW',
    ...extra,
  });
  expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(201);
  return respuesta.body.envio as { id: string; paquetes: Array<{ id: string }> };
}

describe('cuentas', () => {
  it('caso feliz: el cliente se registra y queda con sesión; la cédula no se devuelve completa', async () => {
    const { agente, datos } = await registrarCliente(entorno);
    const yo = await agente.get('/api/auth/yo');
    expect(yo.status).toBe(200);
    expect(JSON.stringify(yo.body)).not.toContain(datos.cedula);
    expect(yo.body.usuario.cedulaEnmascarada).toMatch(/^V-\*\*\*\d{3}$/);
  });

  it('error: cédula o teléfono repetidos no crean otra cuenta', async () => {
    const { datos } = await registrarCliente(entorno);
    const repetida = await entorno.agente().post('/api/auth/registro').send({ ...datos, telefono: '573009998877' });
    expect(repetida.status).toBe(409);
    const mismoTelefono = await entorno.agente().post('/api/auth/registro').send({ ...datosCliente(), telefono: datos.telefono });
    expect(mismoTelefono.status).toBe(409);
  });

  it('error: datos inválidos devuelven 400', async () => {
    const respuesta = await entorno.agente().post('/api/auth/registro').send({ ...datosCliente(), cedula: '12' });
    expect(respuesta.status).toBe(400);
  });

  it('límite: tras 5 fallos seguidos se bloquea el intento', async () => {
    const { datos } = await registrarCliente(entorno);
    for (let i = 0; i < 5; i += 1) {
      const fallo = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: 'incorrecta1' });
      expect(fallo.status).toBe(401);
    }
    const bloqueado = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(bloqueado.status).toBe(429);
  });

  it('caso feliz: el cliente recibe un número de casillero VENV-000000 y entra con él o con su correo', async () => {
    const { datos, agente } = await registrarCliente(entorno);
    const yo = await agente.get('/api/auth/yo');
    expect(yo.body.usuario.codigo).toMatch(/^VENV-\d{6}$/);
    expect(yo.body.usuario.email).toBe(datos.email);
    const porCodigo = await entorno.agente().post('/api/auth/login').send({ identificador: yo.body.usuario.codigo.toLowerCase(), contrasena: datos.contrasena });
    expect(porCodigo.status).toBe(200);
    const porCorreo = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email.toUpperCase(), contrasena: datos.contrasena });
    expect(porCorreo.status).toBe(200);
  });

  it('error: el teléfono ya no sirve para entrar', async () => {
    const { datos } = await registrarCliente(entorno);
    const respuesta = await entorno.agente().post('/api/auth/login').send({ identificador: datos.telefono, contrasena: datos.contrasena });
    expect(respuesta.status).toBe(401);
  });

  it('error: correo repetido o inválido no crea cuenta', async () => {
    const { datos } = await registrarCliente(entorno);
    const repetido = await entorno.agente().post('/api/auth/registro').send({ ...datosCliente(), email: datos.email.toUpperCase() });
    expect(repetido.status).toBe(409);
    const invalido = await entorno.agente().post('/api/auth/registro').send({ ...datosCliente(), email: 'sin-arroba' });
    expect(invalido.status).toBe(400);
  });

  it('error: contraseñas sin mayúscula, sin carácter especial o cortas se rechazan', async () => {
    for (const contrasena of ['clave2026!', 'Clave20260', 'Cl2026!']) {
      const respuesta = await entorno.agente().post('/api/auth/registro').send({ ...datosCliente(), contrasena });
      expect(respuesta.status).toBe(400);
    }
  });

  it('el número de casillero repetido se vuelve a generar', async () => {
    const secuencia = ['111111', '111111', '222222'];
    const repos = crearRepositoriosMemoria();
    const servicio = new AuthService(repos.usuarios, new CifradoCedula('a'.repeat(64)), 'secreto-de-prueba-largo', undefined, () => secuencia.shift() ?? '999999');
    const base = { nombre: 'Ana Perez', email: 'a@correo.com', telefono: '584141111111', cedula: '11111111', contrasena: 'ClavePrueba2026!' };
    const primero = await servicio.registrarCliente(base);
    const segundo = await servicio.registrarCliente({ ...base, email: 'b@correo.com', telefono: '584142222222', cedula: '22222222' });
    expect(primero.usuario.codigo).toBe('VENV-111111');
    expect(segundo.usuario.codigo).toBe('VENV-222222');
  });

  it('sin sesión se rechaza con 401', async () => {
    expect((await entorno.agente().get('/api/envios')).status).toBe(401);
  });

  it('contraseña temporal obliga a cambiarla', async () => {
    const { usuario, datos } = await registrarCliente(entorno);
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const respuesta = await agente.post(`/api/staff/clientes/${usuario.id}/clave-temporal`);
    expect(respuesta.status).toBe(200);
    const entrada = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: respuesta.body.temporal });
    expect(entrada.status).toBe(200);
    expect(entrada.body.usuario.debeCambiarClave).toBe(true);
    const viejaYa = await entorno.agente().post('/api/auth/login').send({ identificador: datos.email, contrasena: datos.contrasena });
    expect(viejaYa.status).toBe(401);
  });
});

describe('permisos', () => {
  it('un cliente no ve los envíos de otro ni entra al panel', async () => {
    const dueno = await registrarCliente(entorno);
    const ajeno = await registrarCliente(entorno);
    const envio = await prealertar(dueno.agente, ['XC-000111222']);
    expect((await ajeno.agente.get(`/api/envios/${envio.id}`)).status).toBe(404);
    expect((await ajeno.agente.get('/api/envios')).body.envios).toHaveLength(0);
    expect((await ajeno.agente.get('/api/staff/resumen')).status).toBe(403);
    expect((await ajeno.agente.get('/api/admin/usuarios')).status).toBe(403);
  });

  it('el operador no puede corregir precios ni entrar al área de administración', async () => {
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await agente.get('/api/admin/usuarios')).status).toBe(403);
    expect((await agente.post('/api/admin/envios/abc/ajuste').send({ motivo: 'prueba larga' })).status).toBe(403);
  });
});

type Agente = Awaited<ReturnType<typeof registrarCliente>>['agente'];

async function recibir(operador: Agente, trackings: string[]) {
  for (const texto of trackings) {
    const respuesta = await operador.post('/api/staff/escaneo').send({ texto });
    if (respuesta.status !== 200) throw new Error(`Escaneo falló: ${JSON.stringify(respuesta.body)}`);
  }
}

async function consolidar(agente: Agente, paqueteIds: string[], extra: Record<string, unknown> = {}) {
  const respuesta = await agente.post('/api/envios/consolidar').send({ paqueteIds, modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 60, ...extra });
  if (respuesta.status !== 201) throw new Error(`Consolidar falló: ${JSON.stringify(respuesta.body)}`);
  return respuesta.body.envio as { id: string; estado: string; paquetes: Array<{ id: string; tracking: string }> };
}

async function subirPago(agente: Agente, envioId: string, campos: { metodo: string; moneda: string; monto: string; referencia: string }) {
  return agente
    .post(`/api/envios/${envioId}/pagos`)
    .field('metodo', campos.metodo)
    .field('moneda', campos.moneda)
    .field('monto', campos.monto)
    .field('referencia', campos.referencia)
    .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
}

async function consolidadoCotizado(pesoKg = 4, valorDeclaradoUsd = 0) {
  const cliente = await registrarCliente(entorno);
  const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
  const tracking = `PAG-${Math.floor(Math.random() * 1e8)}`;
  const alerta = await prealertar(cliente.agente, [tracking], { valorDeclaradoUsd: 0 });
  await recibir(operador.agente, [tracking]);
  const consolidado = await consolidar(cliente.agente, [alerta.paquetes[0]!.id], { valorDeclaradoUsd });
  const cotizado = await operador.agente.post(`/api/staff/envios/${consolidado.id}/cotizar`).send({ pesoKg });
  if (cotizado.status !== 200) throw new Error(`Cotizar falló: ${JSON.stringify(cotizado.body)}`);
  return { cliente, operador: operador.agente, envioId: consolidado.id, total: cotizado.body.envio.precio.totalCentavos as number };
}

describe('flujo completo de un envío', () => {
  it('alerta, escaneo, bodega, consolidación, peso, pago exacto, entrega, despacho y entregado', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['XC-000111222', 'XC-000111223', 'XC-000111224']);

    const escaneo = await operador.post('/api/staff/escaneo').send({ texto: ' xc000111222 ' });
    expect(escaneo.body.resultado).toBe('RECIBIDO');
    expect(escaneo.body.faltan).toBe(2);
    expect((await operador.post('/api/staff/escaneo').send({ texto: 'XC-000111222' })).body.resultado).toBe('YA_REGISTRADO');
    await recibir(operador, ['XC-000111223', 'XC-000111224']);

    const enBodega = await operador.get(`/api/envios/${alerta.id}`);
    expect(enBodega.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    expect(enBodega.body.envio.precio).toBeNull();
    const conPeso = await operador.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/peso`).send({ pesoKg: 2.4 });
    expect(conPeso.status).toBe(200);
    expect(conPeso.body.envio.precio).toBeNull();

    const llegada = await operador.get(`/api/staff/envios/${alerta.id}/mensaje/llegada?paqueteId=${alerta.paquetes[0]!.id}`);
    expect(llegada.status).toBe(200);
    expect(llegada.body.movil).toContain('https://wa.me/57');
    expect(llegada.body.web).toContain('web.whatsapp.com/send?phone=');
    expect(llegada.body.texto).toContain('Han llegado 3 de 3');
    expect(llegada.body.texto).toContain('/cuenta/consolidar');
    expect(llegada.body.texto).not.toContain('$');
    expect((await operador.get(`/api/staff/envios/${alerta.id}/mensaje/cotizacion`)).status).toBe(400);

    const consolidado = await consolidar(cliente.agente, alerta.paquetes.map((p) => p.id));
    expect(consolidado.estado).toBe('POR_CONSOLIDAR');
    expect(consolidado.paquetes).toHaveLength(3);
    expect((await cliente.agente.get(`/api/envios/${alerta.id}`)).body.envio.estado).toBe('ARCHIVADO');
    expect((await cliente.agente.get(`/api/envios/${consolidado.id}/pago`)).status).toBe(400);

    const cotizado = await operador.post(`/api/staff/envios/${consolidado.id}/cotizar`).send({ pesoKg: 4.35 });
    expect(cotizado.body.envio.estado).toBe('POR_PAGAR');
    expect(cotizado.body.envio.precio.totalCentavos).toBe(4433);
    expect(cotizado.body.envio.precio.totalBsCentavos).toBe(Math.round(4433 * 900));
    const cotizacion = await operador.get(`/api/staff/envios/${consolidado.id}/mensaje/cotizacion`);
    expect(cotizacion.body.texto).toContain('44.33 $');
    expect(cotizacion.body.texto).toContain('Peso total del envío: 4.35 kg');

    const sinPagar = await operador.post(`/api/staff/envios/${consolidado.id}/despachar`).field('guia', 'MRW123456');
    expect(sinPagar.body.error.codigo).toBe('DESPACHO_SIN_PAGO');

    const info = await cliente.agente.get(`/api/envios/${consolidado.id}/pago`);
    expect(info.body.saldoCentavos).toBe(4433);
    expect(info.body.datosPago.esPrueba).toBe(true);

    const deMas = await subirPago(cliente.agente, consolidado.id, { metodo: 'BINANCE', moneda: 'USD', monto: '50', referencia: '998877' });
    expect(deMas.status).toBe(400);
    expect(deMas.body.error.codigo).toBe('MONTO_NO_EXACTO');
    expect(deMas.body.error.mensaje).toContain('WhatsApp');
    const referenciaMala = await subirPago(cliente.agente, consolidado.id, { metodo: 'BINANCE', moneda: 'USD', monto: '44.33', referencia: 'BIN-998877' });
    expect(referenciaMala.body.error.codigo).toBe('REFERENCIA_INVALIDA');
    const sinComprobante = await cliente.agente.post(`/api/envios/${consolidado.id}/pagos`).field('metodo', 'BINANCE').field('moneda', 'USD').field('monto', '44.33').field('referencia', '998877');
    expect(sinComprobante.status).toBe(400);

    const subido = await subirPago(cliente.agente, consolidado.id, { metodo: 'BINANCE', moneda: 'USD', monto: '44.33', referencia: '998877' });
    expect(subido.status).toBe(201);
    expect(subido.body.envio.estado).toBe('POR_CONFIRMAR');
    const otraVez = await subirPago(cliente.agente, consolidado.id, { metodo: 'BINANCE', moneda: 'USD', monto: '44.33', referencia: '998877' });
    expect(otraVez.body.error.codigo).toBe('PAGO_EN_REVISION');

    const confirmado = await operador.post(`/api/staff/pagos/${subido.body.envio.pagos[0].id}/confirmar`);
    expect(confirmado.body.envio.estado).toBe('PAGADO');

    const sinEntrega = await operador.post(`/api/staff/envios/${consolidado.id}/despachar`).field('guia', 'MRW123456');
    expect(sinEntrega.body.error.codigo).toBe('DESPACHO_INCOMPLETO');
    const entrega = await cliente.agente.put(`/api/envios/${consolidado.id}/entrega`).send({
      nombre: 'Ana Pérez',
      cedula: '12345678',
      telefono: '584141234567',
      agencia: 'MRW Chacao',
      ciudad: 'Caracas',
      estado: 'Miranda',
    });
    expect(entrega.body.envio.entrega.cedula).toBe('12345678');

    const despacho = await operador
      .post(`/api/staff/envios/${consolidado.id}/despachar`)
      .field('guia', 'MRW-778899')
      .attach('archivo', PNG_MINIMO, { filename: 'guia.png', contentType: 'image/png' });
    expect(despacho.body.envio.estado).toBe('DESPACHADO');
    const aviso = await operador.get(`/api/staff/envios/${consolidado.id}/mensaje/despacho`);
    expect(aviso.body.texto).toContain('MRW-778899');
    expect(aviso.body.tieneFotoGuia).toBe(true);

    const foto = despacho.body.envio.guia.fotoRuta as string;
    expect((await cliente.agente.get(`/api/archivos/${foto}`)).status).toBe(200);
    const ajeno = await registrarCliente(entorno);
    expect((await ajeno.agente.get(`/api/archivos/${foto}`)).status).toBe(404);

    const entregado = await operador.post(`/api/staff/envios/${consolidado.id}/cerrar`);
    expect(entregado.body.envio.estado).toBe('CERRADO');

    const historial = await operador.get(`/api/staff/envios/${consolidado.id}/historial`);
    expect(historial.body.eventos.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(historial.body)).not.toContain('12345678');
  });

  it('modalidad 2 con menos de 2 kg; el cliente cambia a modalidad 1 y paga como 2 kg', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['SHE-55501234']);
    await recibir(operador, ['SHE-55501234']);
    const consolidado = await consolidar(cliente.agente, [alerta.paquetes[0]!.id], { modalidad: 'M2', transportista: 'ZOOM' });
    const cotizado = await operador.post(`/api/staff/envios/${consolidado.id}/cotizar`).send({ pesoKg: 0.6 });
    expect(cotizado.body.envio.precio.totalCentavos).toBe(600 + 180);
    expect(cotizado.body.envio.modalidadSugerida).toBe('M2');
    const mensaje = await operador.get(`/api/staff/envios/${consolidado.id}/mensaje/cotizacion`);
    expect(mensaje.body.texto).toContain('cobro a destino');
    expect(mensaje.body.texto).toContain('Zoom');
    const cambio = await cliente.agente.patch(`/api/envios/${consolidado.id}`).send({ modalidad: 'M1' });
    expect(cambio.body.envio.precio.pesoCobrableKg).toBe(2);
    expect(cambio.body.envio.precio.totalCentavos).toBe(1900 + 300);
  });
});

describe('bodega y casos especiales', () => {
  it('sin prealerta queda sin dueño, aparece en bodega y se asigna por número de casillero', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    expect((await operador.post('/api/staff/escaneo').send({ texto: 'JD014600099999' })).body.resultado).toBe('SIN_PREALERTA');
    const creado = await operador.post('/api/staff/sin-prealerta').send({ texto: 'JD014600099999' });
    expect(creado.status).toBe(201);
    expect(creado.body.envio.sinDueno).toBe(true);
    expect(creado.body.envio.estado).toBe('RECIBIDO_COMPLETO');

    const bodega = await operador.get('/api/staff/bodega?sinDueno=1');
    expect(bodega.body.paquetes.map((p: { tracking: string }) => p.tracking)).toContain('JD014600099999');
    expect((await operador.get(`/api/staff/envios/${creado.body.envio.id}/mensaje/llegada`)).body.error.codigo).toBe('SIN_DUENO');

    const codigo = (await cliente.agente.get('/api/auth/yo')).body.usuario.codigo as string;
    const encontrados = await operador.get(`/api/staff/clientes?q=${encodeURIComponent(codigo)}`);
    expect(encontrados.body.clientes.map((c: { id: string }) => c.id)).toEqual([cliente.usuario.id]);
    const sinDuenoBuscado = await operador.get(`/api/staff/clientes?q=${encodeURIComponent('VENV-000000')}`);
    expect(sinDuenoBuscado.body.clientes).toHaveLength(0);

    const asignado = await operador.post(`/api/staff/paquetes/${creado.body.envio.paquetes[0].id}/asignar`).send({ clienteId: cliente.usuario.id });
    expect(asignado.body.envio.cliente.id).toBe(cliente.usuario.id);
    expect(asignado.body.envio.sinDueno).toBe(false);
    expect((await operador.get('/api/staff/bodega?sinDueno=1')).body.paquetes).toHaveLength(0);
    const delCliente = await cliente.agente.get('/api/envios');
    expect(JSON.stringify(delCliente.body)).toContain('JD014600099999');
  });

  it('sin prealerta se puede asignar al cliente en el momento de recibirlo', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const creado = await operador.post('/api/staff/sin-prealerta').send({ texto: 'VEN-44556677', clienteId: cliente.usuario.id });
    expect(creado.body.envio.cliente.id).toBe(cliente.usuario.id);
    expect(creado.body.envio.sinDueno).toBe(false);
  });

  it('el cliente reclama un paquete sin dueño con el tracking exacto; un tracking parecido no lo reclama', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    await operador.post('/api/staff/sin-prealerta').send({ texto: 'JD0146000777' });
    await operador.post('/api/staff/sin-prealerta').send({ texto: 'JD0146000888' });
    const alerta = await prealertar(cliente.agente, ['JD0146000777', 'JD0146000889']);
    expect(alerta.paquetes).toHaveLength(2);
    const vista = (await cliente.agente.get(`/api/envios/${alerta.id}`)).body.envio;
    expect(vista.estado).toBe('RECIBIDO_PARCIAL');
    expect(vista.paquetes.find((p: { tracking: string }) => p.tracking === 'JD0146000777').recibido).toBe(true);
    const sinDueno = await operador.get('/api/staff/bodega?sinDueno=1');
    expect(sinDueno.body.paquetes.map((p: { tracking: string }) => p.tracking)).toEqual(['JD0146000888']);
    const historial = await operador.get(`/api/staff/envios/${alerta.id}/historial`);
    expect(historial.body.eventos.some((e: { tipo: string }) => e.tipo === 'RECLAMO')).toBe(true);
  });

  it('el operador cambia el dueño con motivo opcional y puede devolverlo a sin dueño', async () => {
    const equivocado = await registrarCliente(entorno);
    const correcto = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(equivocado.agente, ['CAM-12345678']);
    await recibir(operador, ['CAM-12345678']);
    const cambio = await operador.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/asignar`).send({ clienteId: correcto.usuario.id, motivo: 'La etiqueta decía otro nombre' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.envio.cliente.id).toBe(correcto.usuario.id);
    expect((await operador.get(`/api/envios/${alerta.id}`)).body.envio.estado).toBe('ARCHIVADO');
    const historial = await operador.get(`/api/staff/envios/${alerta.id}/historial`);
    expect(JSON.stringify(historial.body)).toContain('La etiqueta decía otro nombre');
    const sinMotivo = await operador.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/asignar`).send({ clienteId: null });
    expect(sinMotivo.body.envio.sinDueno).toBe(true);
    expect((await equivocado.agente.get('/api/envios')).body.envios.every((e: { estado: string }) => e.estado === 'ARCHIVADO')).toBe(true);
  });

  it('descartar un paquete exige motivo y queda en el historial', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['DES-11112222', 'DES-33334444']);
    await recibir(operador, ['DES-11112222']);
    expect((await operador.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/descartar`).send({ motivo: '' })).status).toBe(400);
    const descartado = await operador.post(`/api/staff/paquetes/${alerta.paquetes[0]!.id}/descartar`).send({ motivo: 'Llegó roto, el cliente pidió desecharlo' });
    expect(descartado.status).toBe(200);
    expect(descartado.body.envio.paquetes).toHaveLength(1);
    expect(descartado.body.envio.estado).toBe('PREALERTADO');
    const historial = await operador.get(`/api/staff/envios/${alerta.id}/historial`);
    expect(JSON.stringify(historial.body)).toContain('Llegó roto');
    expect((await cliente.agente.post(`/api/paquetes/${alerta.paquetes[1]!.id}/eliminar-alerta`)).status).toBe(200);
    expect((await operador.post(`/api/staff/envios/${alerta.id}/cancelar`).send({ motivo: 'no' })).status).toBe(400);
  });

  it('el cliente elimina una alerta pendiente, pero no una ya recibida ni la de otro', async () => {
    const cliente = await registrarCliente(entorno);
    const ajeno = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['ELI-11112222', 'ELI-33334444']);
    await recibir(operador, ['ELI-11112222']);
    expect((await cliente.agente.post(`/api/paquetes/${alerta.paquetes[0]!.id}/eliminar-alerta`)).status).toBe(400);
    expect((await ajeno.agente.post(`/api/paquetes/${alerta.paquetes[1]!.id}/eliminar-alerta`)).status).toBe(404);
    const eliminada = await cliente.agente.post(`/api/paquetes/${alerta.paquetes[1]!.id}/eliminar-alerta`);
    expect(eliminada.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    expect(eliminada.body.envio.paquetes).toHaveLength(1);
  });

  it('el operador consolida, agrega el paquete que llegó de más, quita uno y vuelve a pesar', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(cliente.agente, ['CON-00000001', 'CON-00000002', 'CON-00000003']);
    await recibir(operador, ['CON-00000001', 'CON-00000002', 'CON-00000003']);
    const extra = await operador.post('/api/staff/sin-prealerta').send({ texto: 'CON-00000004', clienteId: cliente.usuario.id });
    const extraId = extra.body.envio.paquetes[0].id as string;

    const consolidado = await consolidar(cliente.agente, alerta.paquetes.map((p) => p.id));
    const primeraCotizacion = await operador.post(`/api/staff/envios/${consolidado.id}/cotizar`).send({ pesoKg: 3 });
    expect(primeraCotizacion.body.envio.estado).toBe('POR_PAGAR');

    const agregado = await operador.post(`/api/staff/envios/${consolidado.id}/paquetes`).send({ paqueteIds: [extraId] });
    expect(agregado.body.envio.paquetes).toHaveLength(4);
    expect(agregado.body.envio.estado).toBe('POR_CONSOLIDAR');
    expect(agregado.body.envio.precio).toBeNull();

    const recotizado = await operador.post(`/api/staff/envios/${consolidado.id}/cotizar`).send({ pesoKg: 4 });
    expect(recotizado.body.envio.precio.totalCentavos).toBe(3800 + 300);

    const quitado = await operador.post(`/api/staff/envios/${consolidado.id}/quitar-paquete`).send({ paqueteId: extraId });
    expect(quitado.body.envio.paquetes).toHaveLength(3);
    expect(quitado.body.envio.estado).toBe('POR_CONSOLIDAR');
    const bodega = await operador.get(`/api/staff/bodega?q=${encodeURIComponent('CON-00000004')}`);
    expect(bodega.body.paquetes[0].cliente.id).toBe(cliente.usuario.id);

    const porPersonal = await operador.post('/api/envios/consolidar').send({ clienteId: cliente.usuario.id, paqueteIds: [extraId], modalidad: 'M2', transportista: 'ZOOM', valorDeclaradoUsd: 10, pesoKg: 1 });
    expect(porPersonal.status).toBe(201);
    expect(porPersonal.body.envio.estado).toBe('POR_PAGAR');
    expect(porPersonal.body.envio.cliente.id).toBe(cliente.usuario.id);
  });

  it('no se consolidan paquetes de otro cliente ni paquetes que aún no llegan', async () => {
    const cliente = await registrarCliente(entorno);
    const otro = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const propia = await prealertar(cliente.agente, ['MIO-11112222', 'MIO-33334444']);
    const ajena = await prealertar(otro.agente, ['TUYO-1111222']);
    await recibir(operador, ['MIO-11112222', 'TUYO-1111222']);
    const conAjeno = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [ajena.paquetes[0]!.id], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 1 });
    expect(conAjeno.body.error.codigo).toBe('PAQUETE_NO_DISPONIBLE');
    const sinLlegar = await cliente.agente.post('/api/envios/consolidar').send({ paqueteIds: [propia.paquetes[1]!.id], modalidad: 'M1', transportista: 'MRW', valorDeclaradoUsd: 1 });
    expect(sinLlegar.body.error.codigo).toBe('PAQUETE_NO_DISPONIBLE');
    expect((await cliente.agente.post(`/api/staff/envios/${propia.id}/cotizar`).send({ pesoKg: 1 })).status).toBe(403);
  });

  it('deshacer un consolidado devuelve los paquetes a la bodega; con un pago en revisión no se puede', async () => {
    const { cliente, envioId, total } = await consolidadoCotizado(4);
    const subido = await subirPago(cliente.agente, envioId, { metodo: 'BINANCE', moneda: 'USD', monto: (total / 100).toFixed(2), referencia: '123456' });
    expect(subido.status).toBe(201);
    expect((await cliente.agente.post(`/api/envios/${envioId}/deshacer`).send({})).body.error.codigo).toBe('ENVIO_BLOQUEADO');

    const segundo = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const alerta = await prealertar(segundo.agente, ['DSH-12345678']);
    await recibir(operador, ['DSH-12345678']);
    const consolidado = await consolidar(segundo.agente, [alerta.paquetes[0]!.id]);
    const deshecho = await segundo.agente.post(`/api/envios/${consolidado.id}/deshacer`).send({});
    expect(deshecho.body.envio.estado).toBe('CANCELADO');
    const otraVez = await consolidar(segundo.agente, [alerta.paquetes[0]!.id]);
    expect(otraVez.estado).toBe('POR_CONSOLIDAR');
  });

  it('tracking repetido avisa y no duplica', async () => {
    const cliente = await registrarCliente(entorno);
    const envio = await prealertar(cliente.agente, ['DUP-12345678']);
    const repetido = await cliente.agente.post('/api/envios').send({ trackings: ['dup 12345678'], tienda: 'x', valorDeclaradoUsd: 1 });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.datos.envioId).toBe(envio.id);
  });
});

describe('pagos', () => {
  it('error: método y moneda deben coincidir (Binance en dólares, pago móvil en bolívares)', async () => {
    const { cliente, envioId } = await consolidadoCotizado();
    for (const [metodo, moneda] of [['BINANCE', 'BS'], ['PAGO_MOVIL', 'USD'], ['TRANSFERENCIA', 'USD']] as const) {
      const respuesta = await subirPago(cliente.agente, envioId, { metodo, moneda, monto: '38', referencia: '000099' });
      expect(respuesta.body.error.codigo).toBe('METODO_MONEDA');
    }
  });

  it('pago exacto en bolívares a la tasa del día; un monto distinto se rechaza', async () => {
    const { cliente, envioId } = await consolidadoCotizado();
    const distinto = await subirPago(cliente.agente, envioId, { metodo: 'PAGO_MOVIL', moneda: 'BS', monto: '34000', referencia: '778899' });
    expect(distinto.body.error.codigo).toBe('MONTO_NO_EXACTO');
    const exacto = await subirPago(cliente.agente, envioId, { metodo: 'PAGO_MOVIL', moneda: 'BS', monto: '34200', referencia: '778899' });
    expect(exacto.status).toBe(201);
    expect(exacto.body.envio.pagos[0].montoUsdCentavos).toBe(3800);
  });

  it('rechazar devuelve el envío a «listo para pagar» y deja el motivo para el aviso', async () => {
    const { cliente, operador, envioId } = await consolidadoCotizado();
    const subido = await subirPago(cliente.agente, envioId, { metodo: 'BINANCE', moneda: 'USD', monto: '38', referencia: '123456' });
    const rechazo = await operador.post(`/api/staff/pagos/${subido.body.envio.pagos[0].id}/rechazar`).send({ motivo: 'No aparece el depósito' });
    expect(rechazo.body.envio.estado).toBe('POR_PAGAR');
    const aviso = await operador.get(`/api/staff/envios/${envioId}/mensaje/pagoRechazado?motivo=${encodeURIComponent('No aparece el depósito')}`);
    expect(aviso.body.texto).toContain('No aparece el depósito');
  });

  it('el personal registra un abono en oficina y el cliente paga el resto exacto', async () => {
    const { cliente, operador, envioId } = await consolidadoCotizado();
    expect((await operador.post(`/api/staff/envios/${envioId}/pago-manual`).send({ metodo: 'MANUAL', moneda: 'USD', monto: 50 })).body.error.codigo).toBe('MONTO_EXCEDIDO');
    const abono = await operador.post(`/api/staff/envios/${envioId}/pago-manual`).send({ metodo: 'MANUAL', moneda: 'USD', monto: 20, referencia: 'efectivo' });
    expect(abono.body.envio.estado).toBe('POR_PAGAR');
    expect(abono.body.envio.pagadoCentavos).toBe(2000);
    const resto = await subirPago(cliente.agente, envioId, { metodo: 'BINANCE', moneda: 'USD', monto: '18', referencia: '654321' });
    expect(resto.status).toBe(201);
    const pendiente = resto.body.envio.pagos.find((p: { estado: string }) => p.estado === 'POR_CONFIRMAR');
    expect((await operador.post(`/api/staff/pagos/${pendiente.id}/confirmar`)).body.envio.estado).toBe('PAGADO');
  });

  it('pago manual por el total confirma de inmediato', async () => {
    const { operador, envioId } = await consolidadoCotizado();
    const respuesta = await operador.post(`/api/staff/envios/${envioId}/pago-manual`).send({ metodo: 'MANUAL', moneda: 'USD', monto: 38, referencia: 'efectivo' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.envio.estado).toBe('PAGADO');
  });

  it('errores: monto cero, imagen inválida y envío sin total', async () => {
    const { cliente, envioId } = await consolidadoCotizado();
    expect((await subirPago(cliente.agente, envioId, { metodo: 'BINANCE', moneda: 'USD', monto: '0', referencia: '000111' })).status).toBe(400);
    const imagenMala = await cliente.agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', '38')
      .field('referencia', '000111')
      .attach('archivo', Buffer.from('no soy imagen'), { filename: 'p.txt', contentType: 'text/plain' });
    expect(imagenMala.status).toBe(400);
    const otro = await prealertar(cliente.agente, ['SIN-12345678']);
    expect((await cliente.agente.get(`/api/envios/${otro.id}/pago`)).status).toBe(400);
  });
});

describe('administración', () => {
  it('el admin corrige el precio con motivo y queda registrado; sin motivo falla', async () => {
    const { envioId } = await consolidadoCotizado(3);
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const sinMotivo = await admin.agente.post(`/api/admin/envios/${envioId}/ajuste`).send({ totalUsd: 20, motivo: 'x' });
    expect(sinMotivo.status).toBe(400);
    const ajuste = await admin.agente.post(`/api/admin/envios/${envioId}/ajuste`).send({ totalUsd: 20, motivo: 'Descuento por cliente frecuente' });
    expect(ajuste.status).toBe(200);
    expect(ajuste.body.envio.precio.totalCentavos).toBe(2000);
    const historial = await admin.agente.get(`/api/staff/envios/${envioId}/historial`);
    const registro = historial.body.eventos.find((e: { tipo: string }) => e.tipo === 'AJUSTE');
    expect(registro.detalle).toContain('Descuento');
  });

  it('el admin edita tarifas y el precio cambia; tramos desordenados se rechazan', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/tarifas')).body.valor;
    const nueva = { ...actual, m2PrecioPorKgCentavos: 700 };
    expect((await admin.agente.put('/api/admin/config/tarifas').send({ valor: nueva })).status).toBe(200);
    const cotizacion = await entorno.agente().post('/api/publico/calculadora').send({ pesoKg: 1, valorDeclaradoUsd: 0 });
    const m2 = cotizacion.body.opciones.find((o: { modalidad: string }) => o.modalidad === 'M2');
    expect(m2.totalCentavos).toBe(700);
    const rota = { ...actual, m1Tramos: [...actual.m1Tramos].reverse() };
    expect((await admin.agente.put('/api/admin/config/tarifas').send({ valor: rota })).status).toBe(400);
    expect((await admin.agente.put('/api/admin/config/inexistente').send({ valor: {} })).status).toBe(404);
  });

  it('el admin crea y desactiva operadores', async () => {
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const nuevo = datosCliente({ nombre: 'Pedro Operador' });
    const creado = await admin.agente.post('/api/admin/usuarios').send({ ...nuevo, rol: 'OPERADOR' });
    expect(creado.status).toBe(201);
    const desactivado = await admin.agente.patch(`/api/admin/usuarios/${creado.body.usuario.id}`).send({ activo: false });
    expect(desactivado.body.usuario.activo).toBe(false);
    const login = await entorno.agente().post('/api/auth/login').send({ identificador: nuevo.email, contrasena: nuevo.contrasena });
    expect(login.status).toBe(401);
  });

  it('las plantillas editables se usan en los mensajes', async () => {
    const cliente = await registrarCliente(entorno);
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const envio = await prealertar(cliente.agente, ['PLA-12345678']);
    const actual = (await admin.agente.get('/api/admin/config/plantillas')).body.valor;
    await admin.agente.put('/api/admin/config/plantillas').send({ valor: { ...actual, llegada: 'Hola {nombre}, llegó {tracking}. Gracias.' } });
    const mensaje = await admin.agente.get(`/api/staff/envios/${envio.id}/mensaje/llegada`);
    expect(mensaje.body.texto).toBe('Hola Maria, llegó PLA-12345678. Gracias.');
  });
});

describe('público y tasa', () => {
  it('la calculadora devuelve las dos modalidades y bolívares; peso inválido es 400', async () => {
    const respuesta = await entorno.agente().post('/api/publico/calculadora').send({ pesoKg: 4.35, valorDeclaradoUsd: 60 });
    expect(respuesta.status).toBe(200);
    const [m2, m1] = respuesta.body.opciones;
    expect(m2.totalCentavos).toBe(2790);
    expect(m1.totalCentavos).toBe(4433);
    expect(m2.cobroADestino).toBe(true);
    expect(m1.totalBsCentavos).toBe(4433 * 900);
    expect((await entorno.agente().post('/api/publico/calculadora').send({ pesoKg: 0 })).status).toBe(400);
  });

  it('la información pública trae MRW y Zoom y no expone datos de clientes ni de pago', async () => {
    const respuesta = await entorno.agente().get('/api/publico/info');
    expect(respuesta.body.transportistas.map((t: { codigo: string }) => t.codigo)).toEqual(['MRW', 'ZOOM']);
    expect(JSON.stringify(respuesta.body)).not.toContain('PRUEBA');
  });

  it('si la API de la tasa falla usa la última guardada y avisa', async () => {
    let fallar = false;
    const propio = await crearEntorno({
      consultaTasa: async () => {
        if (fallar) throw new Error('caído');
        return 950;
      },
    });
    expect((await propio.contexto.tasas.vigente()).desactualizada).toBe(false);
    fallar = true;
    await propio.contexto.repos.config.guardarTasa({ fecha: '2026-11-18', bolivaresPorUsd: 940, fuente: 'API' });
    const hoyGuardada = await propio.contexto.tasas.vigente();
    expect(hoyGuardada.bolivaresPorUsd).toBe(950);
  });

  it('sin tasa disponible el sistema pide cargarla; el admin puede cargarla a mano', async () => {
    const propio = await crearEntorno({
      consultaTasa: async () => {
        throw new Error('caído');
      },
    });
    await expect(propio.contexto.tasas.vigente()).rejects.toThrow('No hay tasa BCV');
    const manual = await propio.contexto.tasas.cargarManual(920.5, 'admin');
    expect(manual.fuente).toBe('MANUAL');
    expect((await propio.contexto.tasas.vigente()).bolivaresPorUsd).toBe(920.5);
    await expect(propio.contexto.tasas.cargarManual(0, 'admin')).rejects.toThrow();
  });
});
