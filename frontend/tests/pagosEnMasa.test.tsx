import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorConfirmar } from '../src/components/Confirmar';
import { ProveedorAvisos } from '../src/components/ui';
import PagosPendientes from '../src/pages/panel/PagosPendientes';
import type { FilaPago } from '../src/lib/tipos';

const FILAS: FilaPago[] = [
  { pagoId: 'p2', envioId: 'e2', numero: 124, cliente: 'Rosa Prueba', metodo: 'PAGO_MOVIL', moneda: 'BS', montoUsdCentavos: 2000, montoOriginalCentavos: 7600000, referencia: '778899', tieneComprobante: true, creadoEn: '2026-11-20T10:00:00Z' },
  { pagoId: 'p1', envioId: 'e1', numero: 123, cliente: 'Ana Prueba', metodo: 'BINANCE', moneda: 'USD', montoUsdCentavos: 4325, montoOriginalCentavos: 4325, referencia: 'BIN123456', tieneComprobante: true, creadoEn: '2026-11-19T10:00:00Z' },
  { pagoId: 'p3', envioId: 'e3', numero: 125, cliente: 'Carlos Prueba', metodo: 'MANUAL', moneda: 'USD', montoUsdCentavos: 1000, montoOriginalCentavos: 1000, referencia: null, tieneComprobante: false, creadoEn: '2026-11-21T10:00:00Z' },
];

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: unknown;
}

let llamadas: Llamada[] = [];

function simular(opciones: { pagos?: FilaPago[]; lote?: Record<string, unknown>; fallaCarga?: boolean } = {}) {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, pedido?: RequestInit) => {
      const metodo = pedido?.method ?? 'GET';
      const cuerpo = typeof pedido?.body === 'string' ? JSON.parse(pedido.body) : null;
      llamadas.push({ url, metodo, cuerpo });
      if (url === '/api/staff/pagos/pendientes') {
        if (opciones.fallaCarga) return new Response(JSON.stringify({ error: { mensaje: 'Se cayó la conexión con el servidor.' } }), { status: 500 });
        return new Response(JSON.stringify({ pagos: opciones.pagos ?? FILAS }), { status: 200 });
      }
      if (url === '/api/staff/pagos/confirmar-lote') {
        return new Response(JSON.stringify(opciones.lote ?? { confirmados: [], fallidos: [], enviosPagados: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { mensaje: 'Ruta sin preparar' } }), { status: 404 });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter>
      <ProveedorAvisos>
        <ProveedorConfirmar>
          <PagosPendientes />
        </ProveedorConfirmar>
      </ProveedorAvisos>
    </MemoryRouter>,
  );
}

function filasDeLaTabla() {
  return screen.getAllByRole('row').slice(1).filter((fila) => fila.querySelector('td'));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pagos por revisar en masa (RF-138 a RF-143)', () => {
  it('caso feliz: muestra todos los pagos en una tabla, del más reciente al más antiguo, con su total', async () => {
    simular();
    mostrar();
    expect(await screen.findByRole('table')).toBeTruthy();
    const nombres = filasDeLaTabla().map((fila) => within(fila).getAllByRole('cell')[1]?.textContent ?? '');
    expect(nombres[0]).toContain('Carlos Prueba');
    expect(nombres[1]).toContain('Rosa Prueba');
    expect(nombres[2]).toContain('Ana Prueba');
    expect(document.body.textContent).toContain('3 pagos · ');
  });

  it('caso feliz: el buscador y el filtro por método reducen la lista al instante', async () => {
    simular();
    mostrar();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'rosa' } });
    expect(filasDeLaTabla()).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'BINANCE' } });
    expect(filasDeLaTabla()).toHaveLength(1);
    expect(screen.getByText('Ana Prueba')).toBeTruthy();
  });

  it('caso feliz: marcar pagos muestra cuántos hay y su suma, y confirmar envía todos en un solo lote', async () => {
    simular({ lote: { confirmados: ['p1', 'p2'], fallidos: [], enviosPagados: 2 } });
    mostrar();
    await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText('Seleccionar pago de Ana Prueba'));
    fireEvent.click(screen.getByLabelText('Seleccionar pago de Rosa Prueba'));
    expect(screen.getByText(/^2 seleccionados/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar 2 seleccionados' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar 2' }));
    expect(await screen.findByText(/2 pagos confirmados\. 2 envíos quedaron pagados\./)).toBeTruthy();
    const lote = llamadas.find((l) => l.url === '/api/staff/pagos/confirmar-lote');
    expect(lote?.cuerpo).toEqual({ ids: ['p2', 'p1'] });
    expect(llamadas.filter((l) => l.url === '/api/staff/pagos/confirmar-lote')).toHaveLength(1);
  });

  it('límite: «seleccionar todos» marca solo los pagos que se ven con el filtro actual', async () => {
    simular();
    mostrar();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'PAGO_MOVIL' } });
    fireEvent.click(screen.getByLabelText('Seleccionar todos los pagos visibles'));
    expect(screen.getByText(/^1 seleccionados/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'TODOS' } });
    expect(screen.getByLabelText('Seleccionar pago de Ana Prueba')).toHaveProperty('checked', false);
    expect(screen.getByLabelText('Seleccionar pago de Rosa Prueba')).toHaveProperty('checked', true);
  });

  it('límite: cancelar la confirmación no envía nada', async () => {
    simular();
    mostrar();
    await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText('Seleccionar pago de Ana Prueba'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar 1 seleccionados' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mejor no' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(llamadas.some((l) => l.url === '/api/staff/pagos/confirmar-lote')).toBe(false);
  });

  it('error: si un pago del lote no se confirma, los demás sí y el motivo aparece en el resumen', async () => {
    simular({ lote: { confirmados: ['p1'], fallidos: [{ id: 'p2', motivo: 'Ese pago ya fue revisado.' }], enviosPagados: 1 } });
    mostrar();
    await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText('Seleccionar pago de Ana Prueba'));
    fireEvent.click(screen.getByLabelText('Seleccionar pago de Rosa Prueba'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar 2 seleccionados' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar 2' }));
    expect(await screen.findByText(/1 pago confirmado\. 1 envío quedó pagado\. 1 no se confirmaron: Ese pago ya fue revisado\./)).toBeTruthy();
  });

  it('error: si no carga la lista muestra el error con reintentar', async () => {
    simular({ fallaCarga: true });
    mostrar();
    expect(await screen.findByText('Se cayó la conexión con el servidor.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
