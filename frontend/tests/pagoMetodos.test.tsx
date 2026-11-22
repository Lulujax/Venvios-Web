import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagoCliente } from '../src/components/envio/PagoCliente';
import { ProveedorAvisos } from '../src/components/ui';
import type { Envio, InfoPago } from '../src/lib/tipos';

const DATOS = {
  esPrueba: false,
  pagoMovil: { activo: true, banco: 'Banco de Venezuela', cedula: '17353702', telefono: '04142448341' },
  cuenta: { activo: true, tipo: 'CORRIENTE' as const, banco: 'Banco de Venezuela', numero: '0102-0467-47-0000261658', titular: 'Carlos Belisario', cedula: '17353702' },
  binance: { activo: false, usuario: '', correo: '', nota: '' },
  notaVerificacion: 'Pasar captura del pago para verificación respectiva.',
};

function info(metodosDisponibles: InfoPago['metodosDisponibles'], datosPago = DATOS): InfoPago {
  return {
    metodosDisponibles,
    totalCentavos: 4850,
    pagadoCentavos: 0,
    saldoCentavos: 4850,
    saldoBsCentavos: 4450000,
    tasa: { bolivaresPorUsd: 917.7751, fecha: '2026-11-22', desactualizada: false },
    datosPago,
    modalidad: 'TODO_INCLUIDO',
    transportista: 'MRW',
  } as unknown as InfoPago;
}

function envio(): Envio {
  return { id: 'e1', pagadoCentavos: 0, pagos: [] } as unknown as Envio;
}

function simular(respuesta: InfoPago) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(respuesta), { status: 200 })));
}

function mostrar() {
  return render(
    <ProveedorAvisos>
      <PagoCliente envio={envio()} alCambiar={() => undefined} />
    </ProveedorAvisos>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('métodos visibles en la pantalla de pago del cliente (RF-178, RF-181)', () => {
  it('caso feliz: con transferencia y pago móvil muestra solo esos dos en el selector y sus datos', async () => {
    simular(info(['PAGO_MOVIL', 'TRANSFERENCIA']));
    mostrar();
    expect(await screen.findByRole('heading', { name: 'Pago móvil' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Transferencia' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Binance' })).toBeNull();
    expect(screen.getByText('Corriente')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pago móvil' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Binance' })).toBeNull();
  });

  it('límite: con un solo método visible solo aparece ese en el selector', async () => {
    simular(info(['TRANSFERENCIA']));
    mostrar();
    expect(await screen.findByRole('heading', { name: 'Transferencia' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pago móvil' })).toBeNull();
    const selector = screen.getByLabelText('Pagaste por');
    expect(Array.from(selector.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['Transferencia']);
  });

  it('error: sin ningún método visible avisa al cliente y no muestra el formulario', async () => {
    simular(info([], { ...DATOS }));
    mostrar();
    expect(await screen.findByText(/no hay métodos de pago disponibles/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar comprobante' })).toBeNull();
  });
});
