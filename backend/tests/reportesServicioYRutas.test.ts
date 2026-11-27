import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

describe('ReporteService y rutas de reportes (T-8, T-11)', () => {
  it('T-8: ReporteService devuelve los tres reportes con repositorios en memoria y rechaza a un cliente', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, { nombre: 'Lucia Reporte' });

    await expect(
      entorno.contexto.reportes.generar({ id: cliente.usuario.id, rol: 'CLIENTE' }, 'inventario', {}),
    ).rejects.toThrow(/permiso/i);

    await expect(
      entorno.contexto.reportes.generar({ id: 'op', rol: 'OPERADOR' }, 'estado-de-cuenta', {}),
    ).rejects.toThrow(/cliente/i);

    await cliente.agente.post('/api/envios').send({
      trackings: ['RPT-1', 'RPT-2', 'RPT-3', 'RPT-4', 'RPT-5'],
      tienda: 'Shein',
      valoresUsd: [10, 10, 10, 10, 10],
    });

    for (const t of ['RPT-1', 'RPT-2', 'RPT-3']) {
      await operador.agente.post('/api/staff/escaneo').send({ texto: t });
    }
    const enviosCliente = (await cliente.agente.get('/api/envios')).body.envios as Array<{ paquetes: Array<{ id: string; tracking: string }> }>;
    const idsConsolidar = enviosCliente[0]!.paquetes.filter((p) => p.tracking === 'RPT-1' || p.tracking === 'RPT-2').map((p) => p.id);
    await cliente.agente.post('/api/envios/consolidar').send({
      paqueteIds: idsConsolidar,
      modalidad: 'M1',
      transportista: 'MRW',
    });

    const inv = await entorno.contexto.reportes.generar({ id: 'op', rol: 'OPERADOR' }, 'inventario', {});
    expect(inv.reporte.tipo).toBe('inventario');
    if (inv.reporte.tipo === 'inventario') {
      expect(inv.reporte.resumen.totalPaquetes).toBe(3);
      expect(inv.reporte.resumen.porEtapa.EN_BODEGA).toBe(1);
      expect(inv.reporte.resumen.porEtapa.ESPERANDO_PAGO).toBe(2);
    }

    const pre = await entorno.contexto.reportes.generar({ id: 'op', rol: 'OPERADOR' }, 'prealertas-pendientes', {});
    expect(pre.reporte.tipo).toBe('prealertas-pendientes');
    if (pre.reporte.tipo === 'prealertas-pendientes') {
      expect(pre.reporte.resumen.totalPaquetesPorLlegar).toBe(2);
      const p = pre.reporte.clientes[0]!.prealertas[0]!;
      expect(p.llegaron).toBe(3);
      expect(p.total).toBe(5);
      expect(p.trackingsFaltantes).toEqual(['RPT-4', 'RPT-5']);
    }

    const cuenta = await entorno.contexto.reportes.generar(
      { id: 'op', rol: 'OPERADOR' },
      'estado-de-cuenta',
      { clienteId: cliente.usuario.id },
    );
    expect(cuenta.reporte.tipo).toBe('estado-de-cuenta');
    if (cuenta.reporte.tipo === 'estado-de-cuenta') {
      expect(cuenta.reporte.resumen.porEtapa).toEqual({
        POR_LLEGAR: 2,
        EN_BODEGA: 1,
        ESPERANDO_PAGO: 2,
        LISTO_PARA_SALIR: 0,
        EN_RUTA: 0,
        ENTREGADO: 0,
      });
    }
  });

  it('T-11: rutas HTTP exigen sesión de personal, entregan nombres de archivo exactos y quitan /bodega/exportar.pdf', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno, { nombre: 'Carlos Ruta' });
    const casillero = (await entorno.contexto.repos.usuarios.porId(cliente.usuario.id))!.codigo;

    expect((await cliente.agente.get('/api/staff/reportes/inventario')).status).toBe(401);
    expect((await cliente.agente.get('/api/staff/reportes/inventario.pdf')).status).toBe(401);
    expect((await cliente.agente.get('/api/staff/reportes/inventario.xlsx')).status).toBe(401);
    expect((await entorno.agente().get('/api/staff/reportes/inventario')).status).toBe(401);

    expect((await operador.agente.get('/api/staff/bodega/exportar.pdf')).status).toBe(404);
    expect((await operador.agente.get('/api/staff/bodega/exportar.xlsx')).status).toBe(200);

    const pdfInv = await operador.agente.get('/api/staff/reportes/inventario.pdf');
    expect(pdfInv.status).toBe(200);
    expect(pdfInv.headers['content-type']).toContain('application/pdf');
    expect(pdfInv.headers['content-disposition']).toBe('attachment; filename="inventario-2026-11-19.pdf"');

    const excelPre = await operador.agente.get('/api/staff/reportes/prealertas-pendientes.xlsx');
    expect(excelPre.status).toBe(200);
    expect(excelPre.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(excelPre.headers['content-disposition']).toBe('attachment; filename="prealertas-pendientes-2026-11-19.xlsx"');

    const pdfCuenta = await operador.agente.get(`/api/staff/reportes/estado-de-cuenta.pdf?clienteId=${cliente.usuario.id}`);
    expect(pdfCuenta.status).toBe(200);
    expect(pdfCuenta.headers['content-disposition']).toBe(`attachment; filename="estado-de-cuenta-${casillero}-2026-11-19.pdf"`);

    const sinCliente = await operador.agente.get('/api/staff/reportes/estado-de-cuenta');
    expect(sinCliente.status).toBe(400);

    const invertido = await operador.agente.get('/api/staff/reportes/inventario?desde=2026-11-25&hasta=2026-11-10');
    expect(invertido.status).toBe(400);
  });
});
