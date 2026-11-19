import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Calculadora } from '../src/components/Calculadora';
import { Rastreador } from '../src/components/Rastreador';
import { LineaEstado } from '../src/components/envio/LineaEstado';
import { Campo } from '../src/components/ui';
import type { TransportistaPublico } from '../src/lib/tipos';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TRANSPORTISTAS: TransportistaPublico[] = [
  { codigo: 'MRW', nombre: 'MRW', urlRastreo: 'https://mrwve.com', parametroGuia: null },
  { codigo: 'ZOOM', nombre: 'Zoom', urlRastreo: 'https://zoom.red/tracking-de-envios-personas/', parametroGuia: null },
];

describe('Rastreador', () => {
  it('caso feliz: abre la página de la transportista elegida y copia la guía', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    const copiar = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: copiar } });
    render(<Rastreador transportistas={TRANSPORTISTAS} />);
    fireEvent.click(screen.getByLabelText('Zoom'));
    fireEvent.change(screen.getByLabelText('Número de guía'), { target: { value: '4012345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Rastrear/ }));
    await waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0]![0]).toBe('https://zoom.red/tracking-de-envios-personas/');
    expect(copiar).toHaveBeenCalledWith('4012345678');
    expect(await screen.findByText(/Pégala en la página de Zoom/)).toBeInTheDocument();
  });

  it('error: guía vacía no abre nada y avisa', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<Rastreador transportistas={TRANSPORTISTAS} />);
    fireEvent.click(screen.getByRole('button', { name: /Rastrear/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('número de guía');
    expect(abrir).not.toHaveBeenCalled();
  });
});

describe('Calculadora', () => {
  it('caso feliz: muestra las dos modalidades con lo que devuelve el servidor', async () => {
    const cotizacion = {
      pesoKg: 3,
      modalidadSugerida: 'M1',
      tasa: { bolivaresPorUsd: 900, fecha: '2026-11-19', desactualizada: false },
      opciones: [
        { modalidad: 'M2', pesoCobrableCentesimas: 300, precioPorKgCentavos: 600, fleteCentavos: 1800, seguroCentavos: 180, totalCentavos: 1980, totalBsCentavos: 1782000, cobroADestino: true },
        { modalidad: 'M1', pesoCobrableCentesimas: 300, precioPorKgCentavos: 950, fleteCentavos: 2850, seguroCentavos: 300, totalCentavos: 3150, totalBsCentavos: 2835000, cobroADestino: false },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(cotizacion), { status: 200 })));
    render(<Calculadora />);
    expect(await screen.findByText('Envío con todo incluido')).toBeInTheDocument();
    expect(await screen.findByText('Recomendada para este peso')).toBeInTheDocument();
    expect(screen.getAllByText(/pagas a MRW o Zoom al recibir/).length).toBeGreaterThan(0);
  });

  it('error: un peso inválido muestra el mensaje y no llama al servidor', async () => {
    const llamada = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', llamada);
    render(<Calculadora />);
    fireEvent.change(screen.getByLabelText(/Peso del envío/), { target: { value: '-3' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('mayor que cero');
    await new Promise((resolver) => setTimeout(resolver, 450));
    expect(llamada).not.toHaveBeenCalled();
  });
});

describe('piezas de interfaz', () => {
  it('Campo asocia la etiqueta y muestra el error accesible', () => {
    render(<Campo etiqueta="Cédula" error="La cédula debe tener entre 5 y 10 dígitos." />);
    const entrada = screen.getByLabelText('Cédula');
    expect(entrada).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/entre 5 y 10/)).toBeInTheDocument();
  });

  it('LineaEstado marca el paso actual y avisa si está cancelado', () => {
    const { rerender } = render(<LineaEstado estado="POR_CONFIRMAR" />);
    expect(screen.getByText('Pago en revisión').closest('li')).toHaveAttribute('aria-current', 'step');
    rerender(<LineaEstado estado="CANCELADO" />);
    expect(screen.getByText(/fue cancelado/)).toBeInTheDocument();
  });
});
