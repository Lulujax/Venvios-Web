import { describe, expect, it } from 'vitest';
import {
  armarEstadoDeCuenta,
  armarInventario,
  armarPrealertasPendientes,
  etapaDePaquete,
  validarPeriodo,
  type ClienteReporte,
  type PaqueteFuente,
  type PaqueteSinOrigenFuente,
  type PrealertaFuente,
} from '../src/domain/reportes';

const AHORA = new Date('2026-11-27T12:00:00.000Z');
const ANA: ClienteReporte = { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' };
const BETO: ClienteReporte = { id: 'c2', nombre: 'Beto Prueba', codigo: 'VENV-000002' };
const SIN_DUENO: ClienteReporte = { id: 'sd', nombre: 'Sin dueño', codigo: '', sinDueno: true };

function fuente(parcial: Partial<PaqueteFuente> = {}): PaqueteFuente {
  return {
    paqueteId: 'p1',
    tracking: 'TRK-001',
    paqueteEstado: 'RECIBIDO',
    pesoKg: 2,
    recibidoEn: '2026-11-20T10:00:00.000Z',
    avisado: false,
    tieneFoto: true,
    envioId: 'e1',
    envioNumero: 1,
    envioTipo: 'ALERTA',
    envioEstado: 'RECIBIDO_COMPLETO',
    envioTienda: 'Shein',
    envioTransportista: 'MRW',
    envioPesoTotalKg: null,
    envioCreadoEn: '2026-11-18T10:00:00.000Z',
    envioActualizadoEn: '2026-11-20T10:00:00.000Z',
    entregadoEn: null,
    prealertaOrigen: { id: 'e1', tienda: 'Shein', fecha: '2026-11-18T10:00:00.000Z' },
    cliente: ANA,
    ...parcial,
  };
}

describe('etapaDePaquete (T-4)', () => {
  it('identifica las siete etapas y excluye descartados o archivados', () => {
    expect(etapaDePaquete({ paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'PREALERTADO', sinDueno: false })).toBe('POR_LLEGAR');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false })).toBe('EN_BODEGA');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_COMPLETO', sinDueno: true })).toBe('SIN_DUENO');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'POR_CONSOLIDAR', sinDueno: false })).toBe('ESPERANDO_PAGO');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'POR_PAGAR', sinDueno: false })).toBe('ESPERANDO_PAGO');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'POR_CONFIRMAR', sinDueno: false })).toBe('ESPERANDO_PAGO');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'PAGADO', sinDueno: false })).toBe('LISTO_PARA_SALIR');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'DESPACHADO', sinDueno: false })).toBe('EN_RUTA');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'CERRADO', sinDueno: false })).toBe('ENTREGADO');
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'ALERTA', envioEstado: 'CANCELADO', sinDueno: false })).toBeNull();
    expect(etapaDePaquete({ paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'CANCELADO', sinDueno: false })).toBeNull();
    expect(etapaDePaquete({ paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'ARCHIVADO', sinDueno: false })).toBeNull();
  });
});

describe('armarInventario (T-5, T-7b)', () => {
  it('caso feliz: agrupa lo físico por cliente, cuadra etapas, peso y sin avisar', () => {
    const reporte = armarInventario(
      [
        fuente({ paqueteId: 'p1', tracking: 'T1', pesoKg: 1.5, avisado: false }),
        fuente({ paqueteId: 'p2', tracking: 'T2', pesoKg: 2.5, avisado: true }),
        fuente({ paqueteId: 'p3', tracking: 'T3', envioTipo: 'CONSOLIDADO', envioEstado: 'POR_PAGAR', pesoKg: 3, avisado: false }),
        fuente({ paqueteId: 'p4', tracking: 'T4', envioTipo: 'CONSOLIDADO', envioEstado: 'PAGADO', pesoKg: 1, cliente: BETO }),
        fuente({ paqueteId: 'p5', tracking: 'T5', cliente: SIN_DUENO, envioTienda: 'Sin prealerta', prealertaOrigen: null, pesoKg: null }),
        fuente({ paqueteId: 'p6', tracking: 'T6', paqueteEstado: 'ESPERADO', envioEstado: 'PREALERTADO', recibidoEn: null }),
        fuente({ paqueteId: 'p7', tracking: 'T7', envioTipo: 'CONSOLIDADO', envioEstado: 'DESPACHADO' }),
        fuente({ paqueteId: 'p8', tracking: 'T8', envioEstado: 'CANCELADO' }),
      ],
      {},
      AHORA,
    );

    expect(reporte.resumen).toEqual({
      totalPaquetes: 5,
      pesoTotalKg: 8,
      sinAvisar: 1,
      porEtapa: {
        EN_BODEGA: 2,
        SIN_DUENO: 1,
        ESPERANDO_PAGO: 1,
        LISTO_PARA_SALIR: 1,
      },
    });
    expect(reporte.clientes).toHaveLength(3);
  });

  it('límite: lista vacía produce resumen en cero', () => {
    const reporte = armarInventario([], {}, AHORA);
    expect(reporte.clientes).toEqual([]);
    expect(reporte.resumen).toEqual({
      totalPaquetes: 0,
      pesoTotalKg: 0,
      sinAvisar: 0,
      porEtapa: { EN_BODEGA: 0, SIN_DUENO: 0, ESPERANDO_PAGO: 0, LISTO_PARA_SALIR: 0 },
    });
  });

  it('aplica filtros combinados y rango de fechas sobre recibidoEn (incluyendo un solo día)', () => {
    const fuentes = [
      fuente({ paqueteId: 'p1', recibidoEn: '2026-11-01T10:00:00.000Z', avisado: false }),
      fuente({ paqueteId: 'p2', recibidoEn: '2026-11-20T10:00:00.000Z', avisado: false }),
      fuente({ paqueteId: 'p3', recibidoEn: '2026-11-20T11:00:00.000Z', avisado: true }),
      fuente({ paqueteId: 'p4', recibidoEn: '2026-11-20T09:00:00.000Z', cliente: BETO, avisado: false }),
    ];

    const filtrado = armarInventario(
      fuentes,
      { clienteId: 'c1', etapa: 'EN_BODEGA', minDias: 7, soloSinAvisar: true, desde: '2026-11-20', hasta: '2026-11-20' },
      AHORA,
    );
    expect(filtrado.resumen.totalPaquetes).toBe(1);
    expect(filtrado.clientes[0]!.items[0]!.paqueteId).toBe('p2');
  });

  it('error: rechaza rango de fechas invertido o mal formado', () => {
    expect(() => validarPeriodo({ desde: '2026-11-25', hasta: '2026-11-20' })).toThrow(/posterior/);
    expect(() => validarPeriodo({ desde: '2026-02-30' })).toThrow(/válida/);
  });
});

describe('armarPrealertasPendientes (T-6, T-7b)', () => {
  it('muestra "llegaron 3 de 5" aunque 3 estén consolidados o despachados y lista los 2 que faltan', () => {
    const prealerta: PrealertaFuente = {
      envioId: 'a1',
      tienda: 'Shein',
      fechaAviso: '2026-11-17T10:00:00.000Z',
      cliente: ANA,
      paquetesDeOrigen: [
        { paqueteId: '1', tracking: 'SH-1', paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'DESPACHADO', sinDueno: false },
        { paqueteId: '2', tracking: 'SH-2', paqueteEstado: 'RECIBIDO', envioTipo: 'CONSOLIDADO', envioEstado: 'POR_PAGAR', sinDueno: false },
        { paqueteId: '3', tracking: 'SH-3', paqueteEstado: 'RECIBIDO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
        { paqueteId: '4', tracking: 'SH-4', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
        { paqueteId: '5', tracking: 'SH-5', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
        { paqueteId: '6', tracking: 'SH-DESC', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'CANCELADO', sinDueno: false },
      ],
    };
    const sinOrigen: PaqueteSinOrigenFuente[] = [
      {
        paqueteId: 'leg-1',
        clienteId: 'c1',
        fechaReferencia: '2026-11-19T10:00:00.000Z',
        paqueteEstado: 'RECIBIDO',
        envioTipo: 'CONSOLIDADO',
        envioEstado: 'POR_PAGAR',
        envioTienda: 'Shein',
        sinDueno: false,
      },
      {
        paqueteId: 'sin-pre-1',
        clienteId: 'c1',
        fechaReferencia: '2026-11-19T10:00:00.000Z',
        paqueteEstado: 'RECIBIDO',
        envioTipo: 'ALERTA',
        envioEstado: 'RECIBIDO_COMPLETO',
        envioTienda: 'Sin prealerta',
        sinDueno: false,
      },
    ];

    const reporte = armarPrealertasPendientes([prealerta], sinOrigen, {}, AHORA);
    expect(reporte.resumen).toEqual({
      totalPrealertas: 1,
      totalPaquetesPorLlegar: 2,
      totalClientes: 1,
      sinRegistroPrealerta: 1,
    });
    const p = reporte.clientes[0]!.prealertas[0]!;
    expect(p.llegaron).toBe(3);
    expect(p.total).toBe(5);
    expect(p.faltan).toBe(2);
    expect(p.diasDesdeAviso).toBe(10);
    expect(p.trackingsFaltantes).toEqual(['SH-4', 'SH-5']);
  });

  it('filtra por fecha de aviso', () => {
    const vieja: PrealertaFuente = {
      envioId: 'a1',
      tienda: 'Shein',
      fechaAviso: '2026-10-01T10:00:00.000Z',
      cliente: ANA,
      paquetesDeOrigen: [{ paqueteId: '1', tracking: 'OLD-1', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'PREALERTADO', sinDueno: false }],
    };
    const reciente: PrealertaFuente = {
      envioId: 'a2',
      tienda: 'Amazon',
      fechaAviso: '2026-11-22T10:00:00.000Z',
      cliente: ANA,
      paquetesDeOrigen: [{ paqueteId: '2', tracking: 'NEW-1', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'PREALERTADO', sinDueno: false }],
    };

    const reporte = armarPrealertasPendientes([vieja, reciente], [], { desde: '2026-11-20', hasta: '2026-11-27' }, AHORA);
    expect(reporte.resumen.totalPrealertas).toBe(1);
    expect(reporte.clientes[0]!.prealertas[0]!.tienda).toBe('Amazon');
  });
});

describe('armarEstadoDeCuenta (T-7, T-7b)', () => {
  const prealertas: PrealertaFuente[] = [
    {
      envioId: 'a1',
      tienda: 'Shein',
      fechaAviso: '2026-11-22T10:00:00.000Z',
      cliente: ANA,
      paquetesDeOrigen: [
        { paqueteId: 'p-rec', tracking: 'T-REC', paqueteEstado: 'RECIBIDO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
        { paqueteId: 'p-esp', tracking: 'T-ESP', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'RECIBIDO_PARCIAL', sinDueno: false },
      ],
    },
    {
      envioId: 'a-old',
      tienda: 'AliExpress',
      fechaAviso: '2026-10-05T10:00:00.000Z',
      cliente: ANA,
      paquetesDeOrigen: [
        { paqueteId: 'p-esp-old', tracking: 'T-ESP-OLD', paqueteEstado: 'ESPERADO', envioTipo: 'ALERTA', envioEstado: 'PREALERTADO', sinDueno: false },
      ],
    },
  ];

  const paquetes: PaqueteFuente[] = [
    fuente({ paqueteId: 'p-rec', tracking: 'T-REC', envioEstado: 'RECIBIDO_PARCIAL', recibidoEn: '2026-11-23T10:00:00.000Z' }),
    fuente({ paqueteId: 'p-esp', tracking: 'T-ESP', paqueteEstado: 'ESPERADO', envioEstado: 'RECIBIDO_PARCIAL', recibidoEn: null }),
    fuente({ paqueteId: 'p-esp-old', tracking: 'T-ESP-OLD', envioId: 'a-old', paqueteEstado: 'ESPERADO', envioEstado: 'PREALERTADO', recibidoEn: null }),
    fuente({ paqueteId: 'p-pag', tracking: 'T-PAG', envioId: 'c-1', envioNumero: 10, envioTipo: 'CONSOLIDADO', envioEstado: 'POR_PAGAR', recibidoEn: '2026-11-21T10:00:00.000Z' }),
    fuente({ paqueteId: 'p-listo', tracking: 'T-LIS', envioId: 'c-2', envioNumero: 11, envioTipo: 'CONSOLIDADO', envioEstado: 'PAGADO', recibidoEn: '2026-11-21T10:00:00.000Z' }),
    fuente({ paqueteId: 'p-ruta', tracking: 'T-RUT', envioId: 'c-3', envioNumero: 12, envioTipo: 'CONSOLIDADO', envioEstado: 'DESPACHADO', recibidoEn: '2026-11-21T10:00:00.000Z' }),
    fuente({ paqueteId: 'p-ent-in', tracking: 'T-ENT1', envioId: 'c-4', envioNumero: 13, envioTipo: 'CONSOLIDADO', envioEstado: 'CERRADO', recibidoEn: '2026-11-01T10:00:00.000Z', entregadoEn: '2026-11-24T10:00:00.000Z' }),
    fuente({ paqueteId: 'p-ent-out', tracking: 'T-ENT2', envioId: 'c-5', envioNumero: 14, envioTipo: 'CONSOLIDADO', envioEstado: 'CERRADO', recibidoEn: '2026-10-01T10:00:00.000Z', entregadoEn: '2026-10-15T10:00:00.000Z' }),
  ];

  it('sin periodo oculta entregados y cuadra las demás etapas', () => {
    const reporte = armarEstadoDeCuenta(ANA, prealertas, paquetes, {}, AHORA);
    expect(reporte.resumen.incluyeEntregados).toBe(false);
    expect(reporte.entregados).toEqual([]);
    expect(reporte.resumen.porEtapa).toEqual({
      POR_LLEGAR: 2,
      EN_BODEGA: 1,
      ESPERANDO_PAGO: 1,
      LISTO_PARA_SALIR: 1,
      EN_RUTA: 1,
      ENTREGADO: 0,
    });
  });

  it('con periodo aplica aviso a Por llegar, llegada a bodega/consolidados y entrega a Entregado', () => {
    const reporte = armarEstadoDeCuenta(ANA, prealertas, paquetes, { desde: '2026-11-20', hasta: '2026-11-27' }, AHORA);
    expect(reporte.resumen.incluyeEntregados).toBe(true);
    expect(reporte.resumen.porEtapa).toEqual({
      POR_LLEGAR: 1,
      EN_BODEGA: 1,
      ESPERANDO_PAGO: 1,
      LISTO_PARA_SALIR: 1,
      EN_RUTA: 1,
      ENTREGADO: 1,
    });
    expect(reporte.entregados).toHaveLength(1);
    expect(reporte.entregados[0]!.paquetes[0]!.tracking).toBe('T-ENT1');
  });
});
