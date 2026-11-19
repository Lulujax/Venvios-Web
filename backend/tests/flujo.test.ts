import { beforeEach, describe, expect, it } from 'vitest';
import { PNG_MINIMO, crearEntorno, crearPersonalYEntrar, datosCliente, registrarCliente, type Entorno } from './ayudas';

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
      const fallo = await entorno.agente().post('/api/auth/login').send({ telefono: datos.telefono, contrasena: 'incorrecta1' });
      expect(fallo.status).toBe(401);
    }
    const bloqueado = await entorno.agente().post('/api/auth/login').send({ telefono: datos.telefono, contrasena: datos.contrasena });
    expect(bloqueado.status).toBe(429);
  });

  it('sin sesión se rechaza con 401', async () => {
    expect((await entorno.agente().get('/api/envios')).status).toBe(401);
  });

  it('contraseña temporal obliga a cambiarla', async () => {
    const { usuario, datos } = await registrarCliente(entorno);
    const { agente } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const respuesta = await agente.post(`/api/staff/clientes/${usuario.id}/clave-temporal`);
    expect(respuesta.status).toBe(200);
    const entrada = await entorno.agente().post('/api/auth/login').send({ telefono: datos.telefono, contrasena: respuesta.body.temporal });
    expect(entrada.status).toBe(200);
    expect(entrada.body.usuario.debeCambiarClave).toBe(true);
    const viejaYa = await entorno.agente().post('/api/auth/login').send({ telefono: datos.telefono, contrasena: datos.contrasena });
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

describe('flujo completo de un envío', () => {
  it('prealerta, escaneo, peso, pago, entrega y despacho con M1', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const envio = await prealertar(cliente.agente, ['XC-000111222', 'XC-000111223', 'XC-000111224']);

    const escaneo = await operador.post('/api/staff/escaneo').send({ texto: ' xc000111222 ' });
    expect(escaneo.body.resultado).toBe('RECIBIDO');
    expect(escaneo.body.faltan).toBe(2);

    const repetido = await operador.post('/api/staff/escaneo').send({ texto: 'XC-000111222' });
    expect(repetido.body.resultado).toBe('YA_REGISTRADO');

    await operador.post('/api/staff/escaneo').send({ texto: 'XC-000111223' });
    const ultimo = await operador.post('/api/staff/escaneo').send({ texto: 'XC-000111224' });
    expect(ultimo.body.faltan).toBe(0);

    const parcial = await operador.get(`/api/envios/${envio.id}`);
    expect(parcial.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    expect(parcial.body.envio.precio).toBeNull();

    const pesos = [2.4, 1.15, 0.8];
    let vista: { precio: { totalCentavos: number; totalBsCentavos: number } | null; estado: string } | undefined;
    for (const [indice, paquete] of envio.paquetes.entries()) {
      const respuesta = await operador.post(`/api/staff/paquetes/${paquete.id}/peso`).send({ pesoKg: pesos[indice] });
      expect(respuesta.status).toBe(200);
      vista = respuesta.body.envio;
    }
    expect(vista?.precio?.totalCentavos).toBe(4433);
    expect(vista?.precio?.totalBsCentavos).toBe(Math.round(4433 * 900));

    const mensaje = await operador.get(`/api/staff/envios/${envio.id}/mensaje/llegada?paqueteId=${envio.paquetes[0]!.id}`);
    expect(mensaje.status).toBe(200);
    expect(mensaje.body.movil).toContain('https://wa.me/57');
    expect(mensaje.body.web).toContain('web.whatsapp.com/send?phone=');
    expect(mensaje.body.texto).toContain('44.33 $');
    expect(mensaje.body.texto).toContain('Han llegado 3 de 3');

    const sinPagar = await operador.post(`/api/staff/envios/${envio.id}/despachar`).field('guia', 'MRW123456');
    expect(sinPagar.status).toBe(400);
    expect(sinPagar.body.error.codigo).toBe('DESPACHO_SIN_PAGO');

    const info = await cliente.agente.get(`/api/envios/${envio.id}/pago`);
    expect(info.body.saldoCentavos).toBe(4433);
    expect(info.body.datosPago.esPrueba).toBe(true);

    const sinComprobante = await cliente.agente
      .post(`/api/envios/${envio.id}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', '44.33')
      .field('referencia', 'BIN-998877');
    expect(sinComprobante.status).toBe(400);

    const subido = await cliente.agente
      .post(`/api/envios/${envio.id}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', '44.33')
      .field('referencia', 'BIN-998877')
      .attach('archivo', PNG_MINIMO, { filename: 'pago.png', contentType: 'image/png' });
    expect(subido.status).toBe(201);
    expect(subido.body.envio.estado).toBe('POR_CONFIRMAR');
    const pagoId = subido.body.envio.pagos[0].id as string;

    const confirmado = await operador.post(`/api/staff/pagos/${pagoId}/confirmar`);
    expect(confirmado.body.envio.estado).toBe('PAGADO');

    const sinEntrega = await operador.post(`/api/staff/envios/${envio.id}/despachar`).field('guia', 'MRW123456');
    expect(sinEntrega.status).toBe(400);
    expect(sinEntrega.body.error.codigo).toBe('DESPACHO_INCOMPLETO');

    const entrega = await cliente.agente.put(`/api/envios/${envio.id}/entrega`).send({
      nombre: 'Ana Pérez',
      cedula: '12345678',
      telefono: '584141234567',
      agencia: 'MRW Chacao',
      ciudad: 'Caracas',
      estado: 'Miranda',
    });
    expect(entrega.status).toBe(200);
    expect(entrega.body.envio.entrega.cedula).toBe('12345678');

    const despacho = await operador
      .post(`/api/staff/envios/${envio.id}/despachar`)
      .field('guia', 'MRW-778899')
      .attach('archivo', PNG_MINIMO, { filename: 'guia.png', contentType: 'image/png' });
    expect(despacho.status).toBe(200);
    expect(despacho.body.envio.estado).toBe('DESPACHADO');
    expect(despacho.body.envio.guia.tieneFoto).toBe(true);

    const aviso = await operador.get(`/api/staff/envios/${envio.id}/mensaje/despacho`);
    expect(aviso.body.texto).toContain('MRW-778899');
    expect(aviso.body.tieneFotoGuia).toBe(true);

    const foto = despacho.body.envio.guia.fotoRuta as string;
    expect((await cliente.agente.get(`/api/archivos/${foto}`)).status).toBe(200);
    const ajeno = await registrarCliente(entorno);
    expect((await ajeno.agente.get(`/api/archivos/${foto}`)).status).toBe(404);

    const historial = await operador.get(`/api/staff/envios/${envio.id}/historial`);
    expect(historial.body.eventos.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(historial.body)).not.toContain('12345678');
  });

  it('modalidad 2: menos de 2 kg, mínimo de 1 kg y nota de cobro a destino', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const envio = await prealertar(cliente.agente, ['SHE-55501234'], { modalidad: 'M2', transportista: 'ZOOM' });
    await operador.post('/api/staff/escaneo').send({ texto: 'SHE-55501234' });
    const pesado = await operador.post(`/api/staff/paquetes/${envio.paquetes[0]!.id}/peso`).send({ pesoKg: 0.6 });
    expect(pesado.body.envio.precio.totalCentavos).toBe(600 + 180);
    expect(pesado.body.envio.modalidadSugerida).toBe('M2');
    const mensaje = await operador.get(`/api/staff/envios/${envio.id}/mensaje/llegada`);
    expect(mensaje.body.texto).toContain('cobro a destino');
    expect(mensaje.body.texto).toContain('Zoom');
  });

  it('el cliente pasa a modalidad 1 con menos de 2 kg y paga como 2 kg', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const envio = await prealertar(cliente.agente, ['SHE-66601234'], { modalidad: 'M2' });
    await operador.post('/api/staff/escaneo').send({ texto: 'SHE-66601234' });
    await operador.post(`/api/staff/paquetes/${envio.paquetes[0]!.id}/peso`).send({ pesoKg: 1 });
    const cambio = await cliente.agente.patch(`/api/envios/${envio.id}`).send({ modalidad: 'M1' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.envio.precio.pesoCobrableKg).toBe(2);
    expect(cambio.body.envio.precio.totalCentavos).toBe(1900 + 300);
  });
});

describe('recepción especial', () => {
  it('sin prealerta: se registra, se asigna a un cliente y se puede cobrar', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const escaneo = await operador.post('/api/staff/escaneo').send({ texto: 'JD014600099999' });
    expect(escaneo.body.resultado).toBe('SIN_PREALERTA');
    const creado = await operador.post('/api/staff/sin-prealerta').send({ texto: 'JD014600099999' });
    expect(creado.status).toBe(201);
    expect(creado.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    const clientes = await operador.get(`/api/staff/clientes?q=${encodeURIComponent('Maria')}`);
    expect(clientes.body.clientes.length).toBeGreaterThan(0);
    const asignado = await operador.post(`/api/staff/envios/${creado.body.envio.id}/asignar-cliente`).send({ clienteId: cliente.usuario.id });
    expect(asignado.body.envio.cliente.id).toBe(cliente.usuario.id);
  });

  it('cerrar recepción separa los paquetes que faltan en otro envío', async () => {
    const cliente = await registrarCliente(entorno);
    const { agente: operador } = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const envio = await prealertar(cliente.agente, ['AAA-11112222', 'BBB-33334444']);
    await operador.post('/api/staff/escaneo').send({ texto: 'AAA-11112222' });
    const cierre = await cliente.agente.post(`/api/envios/${envio.id}/cerrar-recepcion`);
    expect(cierre.status).toBe(200);
    expect(cierre.body.envio.paquetes).toHaveLength(1);
    expect(cierre.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    const lista = await cliente.agente.get('/api/envios');
    expect(lista.body.envios).toHaveLength(2);
    const pendiente = lista.body.envios.find((e: { id: string }) => e.id !== envio.id);
    expect(pendiente.estado).toBe('PREALERTADO');
    expect(pendiente.paquetes[0].tracking).toBe('BBB-33334444');
  });

  it('tracking repetido avisa y no duplica; cerrar sin paquetes recibidos falla', async () => {
    const cliente = await registrarCliente(entorno);
    const envio = await prealertar(cliente.agente, ['DUP-12345678']);
    const repetido = await cliente.agente.post('/api/envios').send({ trackings: ['dup 12345678'], tienda: 'x', valorDeclaradoUsd: 1, modalidad: 'M1', transportista: 'MRW' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.datos.envioId).toBe(envio.id);
    expect((await cliente.agente.post(`/api/envios/${envio.id}/cerrar-recepcion`)).status).toBe(400);
  });
});

describe('pagos', () => {
  async function envioListoParaPagar() {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const envio = await prealertar(cliente.agente, ['PAG-12345678'], { valorDeclaradoUsd: 0 });
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'PAG-12345678' });
    await operador.agente.post(`/api/staff/paquetes/${envio.paquetes[0]!.id}/peso`).send({ pesoKg: 4 });
    return { cliente, operador: operador.agente, envioId: envio.id };
  }

  it('pago parcial deja saldo y no libera el envío; el segundo pago lo completa', async () => {
    const { cliente, operador, envioId } = await envioListoParaPagar();
    const subir = (monto: string, referencia: string) =>
      cliente.agente
        .post(`/api/envios/${envioId}/pagos`)
        .field('metodo', 'PAGO_MOVIL')
        .field('moneda', 'USD')
        .field('monto', monto)
        .field('referencia', referencia)
        .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });

    const primero = await subir('20', 'REF-0001');
    const confirmado1 = await operador.post(`/api/staff/pagos/${primero.body.envio.pagos[0].id}/confirmar`);
    expect(confirmado1.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    expect(confirmado1.body.envio.pagadoCentavos).toBe(2000);

    const segundo = await subir('18', 'REF-0002');
    const pagoNuevo = segundo.body.envio.pagos.find((p: { estado: string }) => p.estado === 'POR_CONFIRMAR');
    const confirmado2 = await operador.post(`/api/staff/pagos/${pagoNuevo.id}/confirmar`);
    expect(confirmado2.body.envio.estado).toBe('PAGADO');
  });

  it('pago en bolívares usa la tasa del día', async () => {
    const { cliente, envioId } = await envioListoParaPagar();
    const respuesta = await cliente.agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'PAGO_MOVIL')
      .field('moneda', 'BS')
      .field('monto', '34200')
      .field('referencia', 'BS-778899')
      .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
    expect(respuesta.body.envio.pagos[0].montoUsdCentavos).toBe(3800);
  });

  it('rechazar devuelve el envío a cobro y deja el motivo para el aviso', async () => {
    const { cliente, operador, envioId } = await envioListoParaPagar();
    const subido = await cliente.agente
      .post(`/api/envios/${envioId}/pagos`)
      .field('metodo', 'BINANCE')
      .field('moneda', 'USD')
      .field('monto', '38')
      .field('referencia', 'BIN-123456')
      .attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' });
    const rechazo = await operador.post(`/api/staff/pagos/${subido.body.envio.pagos[0].id}/rechazar`).send({ motivo: 'No aparece el depósito' });
    expect(rechazo.body.envio.estado).toBe('RECIBIDO_COMPLETO');
    const aviso = await operador.get(`/api/staff/envios/${envioId}/mensaje/pagoRechazado?motivo=${encodeURIComponent('No aparece el depósito')}`);
    expect(aviso.body.texto).toContain('No aparece el depósito');
  });

  it('pago manual del personal confirma de inmediato', async () => {
    const { operador, envioId } = await envioListoParaPagar();
    const respuesta = await operador.post(`/api/staff/envios/${envioId}/pago-manual`).send({ metodo: 'MANUAL', moneda: 'USD', monto: 38, referencia: 'efectivo' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.envio.estado).toBe('PAGADO');
  });

  it('errores: monto cero, imagen inválida y envío sin total', async () => {
    const { cliente, envioId } = await envioListoParaPagar();
    const base = () => cliente.agente.post(`/api/envios/${envioId}/pagos`).field('metodo', 'BINANCE').field('moneda', 'USD').field('referencia', 'BIN-000111');
    expect((await base().field('monto', '0').attach('archivo', PNG_MINIMO, { filename: 'p.png', contentType: 'image/png' })).status).toBe(400);
    expect((await base().field('monto', '38').attach('archivo', Buffer.from('no soy imagen'), { filename: 'p.txt', contentType: 'text/plain' })).status).toBe(400);
    const otro = await prealertar(cliente.agente, ['SIN-12345678']);
    expect((await cliente.agente.get(`/api/envios/${otro.id}/pago`)).status).toBe(400);
  });
});

describe('administración', () => {
  it('el admin corrige el precio con motivo y queda registrado; sin motivo falla', async () => {
    const cliente = await registrarCliente(entorno);
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const envio = await prealertar(cliente.agente, ['ADM-12345678']);
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'ADM-12345678' });
    await operador.agente.post(`/api/staff/paquetes/${envio.paquetes[0]!.id}/peso`).send({ pesoKg: 3 });

    const sinMotivo = await admin.agente.post(`/api/admin/envios/${envio.id}/ajuste`).send({ totalUsd: 20, motivo: 'x' });
    expect(sinMotivo.status).toBe(400);
    const ajuste = await admin.agente.post(`/api/admin/envios/${envio.id}/ajuste`).send({ totalUsd: 20, motivo: 'Descuento por cliente frecuente' });
    expect(ajuste.status).toBe(200);
    expect(ajuste.body.envio.precio.totalCentavos).toBe(2000);
    const historial = await admin.agente.get(`/api/staff/envios/${envio.id}/historial`);
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
    const login = await entorno.agente().post('/api/auth/login').send({ telefono: nuevo.telefono, contrasena: nuevo.contrasena });
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
