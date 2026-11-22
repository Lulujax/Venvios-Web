import { describe, expect, it } from 'vitest';
import { DATOS_PAGO_INICIALES, type DatosPago } from '../src/config/predeterminados';
import { datosPagoParaCliente, metodosVisibles } from '../src/domain/pagos';

function con(cambios: { pagoMovil?: boolean; cuenta?: boolean; binance?: boolean }): DatosPago {
  return {
    ...DATOS_PAGO_INICIALES,
    pagoMovil: { ...DATOS_PAGO_INICIALES.pagoMovil, activo: cambios.pagoMovil ?? DATOS_PAGO_INICIALES.pagoMovil.activo },
    cuenta: { ...DATOS_PAGO_INICIALES.cuenta, activo: cambios.cuenta ?? DATOS_PAGO_INICIALES.cuenta.activo },
    binance: { ...DATOS_PAGO_INICIALES.binance, activo: cambios.binance ?? DATOS_PAGO_INICIALES.binance.activo },
  };
}

describe('métodos de pago visibles (RF-177, RF-181)', () => {
  it('caso feliz: con la configuración inicial muestran pago móvil y transferencia, y Binance nace oculto', () => {
    expect(metodosVisibles(DATOS_PAGO_INICIALES)).toEqual(['PAGO_MOVIL', 'TRANSFERENCIA']);
  });

  it('caso feliz: cada método se muestra u oculta por separado', () => {
    expect(metodosVisibles(con({ pagoMovil: false, binance: true }))).toEqual(['TRANSFERENCIA', 'BINANCE']);
  });

  it('límite: con los tres ocultos no queda ningún método visible', () => {
    expect(metodosVisibles(con({ pagoMovil: false, cuenta: false, binance: false }))).toEqual([]);
  });

  it('límite: el orden siempre es pago móvil, transferencia y Binance', () => {
    expect(metodosVisibles(con({ pagoMovil: true, cuenta: true, binance: true }))).toEqual(['PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE']);
  });
});

describe('datos de pago que ve el cliente (RF-178)', () => {
  it('caso feliz: un método visible conserva sus datos', () => {
    const cliente = datosPagoParaCliente(DATOS_PAGO_INICIALES);
    expect(cliente.pagoMovil.telefono).toBe(DATOS_PAGO_INICIALES.pagoMovil.telefono);
    expect(cliente.cuenta.numero).toBe(DATOS_PAGO_INICIALES.cuenta.numero);
  });

  it('límite: un método oculto no envía sus datos bancarios al cliente', () => {
    const cliente = datosPagoParaCliente(con({ pagoMovil: false, binance: true }));
    expect(cliente.pagoMovil).toEqual({ activo: false, banco: '', cedula: '', telefono: '' });
    expect(cliente.binance.usuario).toBe(DATOS_PAGO_INICIALES.binance.usuario);
  });

  it('error: no modifica la configuración original del administrador', () => {
    const original = con({ cuenta: false });
    datosPagoParaCliente(original);
    expect(original.cuenta.numero).toBe(DATOS_PAGO_INICIALES.cuenta.numero);
  });
});
