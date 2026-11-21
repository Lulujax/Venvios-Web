import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NuevaPrealerta from '../src/pages/NuevaPrealerta';

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: Record<string, unknown> | null;
}

function simularServidor(llamadas: Llamada[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as Record<string, unknown>) : null;
      llamadas.push({ url, metodo: opciones?.method ?? 'GET', cuerpo });
      return new Response(JSON.stringify({ envio: { id: 'env-1' } }), { status: 201 });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter>
      <NuevaPrealerta personal={false} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Prealerta con valor por guía', () => {
  it('caso feliz: cada guía lleva su valor, el total suma y se envía la lista de valores', async () => {
    const llamadas: Llamada[] = [];
    simularServidor(llamadas);
    mostrar();
    fireEvent.change(screen.getByLabelText('Tracking del paquete 1'), { target: { value: 'XC000123456' } });
    fireEvent.change(screen.getByLabelText('Valor del paquete 1 ($)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar otro paquete/i }));
    fireEvent.change(screen.getByLabelText('Tracking del paquete 2'), { target: { value: 'XC000123457' } });
    fireEvent.change(screen.getByLabelText('Valor del paquete 2 ($)'), { target: { value: '25,5' } });
    expect(screen.getByText('35,50 $')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar paquetes' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST' && l.url === '/api/envios')).toBe(true));
    const cuerpo = llamadas.find((l) => l.url === '/api/envios')!.cuerpo!;
    expect(cuerpo.trackings).toEqual(['XC000123456', 'XC000123457']);
    expect(cuerpo.valoresUsd).toEqual([10, 25.5]);
  });

  it('error: una guía sin valor no se envía y pide el valor de cada paquete', async () => {
    const llamadas: Llamada[] = [];
    simularServidor(llamadas);
    mostrar();
    fireEvent.change(screen.getByLabelText('Tracking del paquete 1'), { target: { value: 'XC000123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar paquetes' }));
    expect(await screen.findByText(/cuánto costó cada paquete/i)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });

  it('límite: una fila vacía se ignora y el valor 0 es válido', async () => {
    const llamadas: Llamada[] = [];
    simularServidor(llamadas);
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: /agregar otro paquete/i }));
    fireEvent.change(screen.getByLabelText('Tracking del paquete 1'), { target: { value: 'XC000123456' } });
    fireEvent.change(screen.getByLabelText('Valor del paquete 1 ($)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar paquetes' }));
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0]!.cuerpo!.valoresUsd).toEqual([0]);
  });

  it('error: sin ningún tracking pide agregar uno', async () => {
    const llamadas: Llamada[] = [];
    simularServidor(llamadas);
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar paquetes' }));
    expect(await screen.findByText(/agrega al menos un número de tracking/i)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });
});
