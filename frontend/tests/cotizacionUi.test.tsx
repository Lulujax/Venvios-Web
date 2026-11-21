import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditarSeguro, EditarValorPaquete } from '../src/components/envio/EditarCotizacion';
import type { Envio, PaqueteVista } from '../src/lib/tipos';

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: Record<string, unknown> | null;
}

function simular(llamadas: Llamada[], respuesta: unknown = { envio: { id: 'env-1' } }, estado = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as Record<string, unknown>) : null;
      llamadas.push({ url, metodo: opciones?.method ?? 'GET', cuerpo });
      return new Response(JSON.stringify(respuesta), { status: estado });
    }),
  );
}

const PAQUETE: PaqueteVista = { id: 'p1', tracking: 'SHN26110040', recibido: true, pesoKg: null, valorDeclaradoCentavos: 3000, tieneFoto: false, fotoRuta: null, avisado: false, recibidoEn: null };

function envioConSeguro(manual: boolean): Envio {
  return {
    id: 'env-1',
    precio: { pesoCobrableKg: 4, precioPorKgCentavos: 950, fleteCentavos: 3800, seguroCentavos: manual ? 750 : 300, seguroManual: manual, totalCentavos: 4100, totalBsCentavos: null },
  } as Envio;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Editar el valor de un paquete', () => {
  it('caso feliz: manda el valor nuevo con su motivo', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas);
    const alCambiar = vi.fn();
    render(<EditarValorPaquete paquete={PAQUETE} alCambiar={alCambiar} />);
    expect(screen.getByText('30,00 $')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /editar valor del paquete shn26110040/i }));
    fireEvent.change(screen.getByLabelText(/valor del paquete shn26110040/i), { target: { value: '55,5' } });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'La factura dice 55,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valor' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
    expect(llamadas[0]!.url).toBe('/api/staff/paquetes/p1/valor');
    expect(llamadas[0]!.cuerpo).toEqual({ valorUsd: 55.5, motivo: 'La factura dice 55,50' });
  });

  it('error: sin motivo o con un valor inválido no se envía', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas);
    render(<EditarValorPaquete paquete={PAQUETE} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar valor/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valor' }));
    expect(await screen.findByText(/escribe el motivo del cambio/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/valor del paquete/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valor' }));
    expect(await screen.findByText(/escribe el valor en dólares/i)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });

  it('error: si el servidor lo prohíbe muestra el mensaje', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas, { error: { mensaje: 'El envío ya tiene un pago registrado.' } }, 403);
    render(<EditarValorPaquete paquete={PAQUETE} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar valor/i }));
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'Corrección de factura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar valor' }));
    expect(await screen.findByText(/ya tiene un pago registrado/i)).toBeTruthy();
  });
});

describe('Editar el seguro', () => {
  it('caso feliz: automático muestra «Editar seguro» y manda el seguro con motivo', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas);
    render(<EditarSeguro envio={envioConSeguro(false)} alCambiar={vi.fn()} />);
    expect(screen.getByText(/automático/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Volver a automático' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Editar seguro' }));
    fireEvent.change(screen.getByLabelText('Seguro de carga ($)'), { target: { value: '7,5' } });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'Descuento acordado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguro' }));
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0]!.cuerpo).toEqual({ seguroUsd: 7.5, motivo: 'Descuento acordado' });
  });

  it('límite: con seguro a mano aparece «Volver a automático» y manda null', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas);
    render(<EditarSeguro envio={envioConSeguro(true)} alCambiar={vi.fn()} />);
    expect(screen.getByText(/editado a mano/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a automático' }));
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0]!.cuerpo).toEqual({ seguroUsd: null, motivo: '' });
  });

  it('error: un seguro negativo o sin motivo no se envía', async () => {
    const llamadas: Llamada[] = [];
    simular(llamadas);
    render(<EditarSeguro envio={envioConSeguro(false)} alCambiar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar seguro' }));
    fireEvent.change(screen.getByLabelText('Seguro de carga ($)'), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguro' }));
    expect(await screen.findByText(/escribe el seguro en dólares/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Seguro de carga ($)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar seguro' }));
    expect(await screen.findByText(/escribe el motivo del cambio/i)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });
});
