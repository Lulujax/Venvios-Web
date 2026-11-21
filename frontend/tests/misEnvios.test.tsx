import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filasDePestana, historialDe, rastrear } from '../src/lib/misEnvios';
import type { Envio, PaqueteVista } from '../src/lib/tipos';
import { MisEnvios } from '../src/pages/cliente/MisEnvios';
import { Rastrear } from '../src/pages/cliente/Rastrear';

function paquete(id: string, tracking: string, recibido: boolean, seguimiento: PaqueteVista['seguimiento'] = []): PaqueteVista {
  return { id, tracking, recibido, pesoKg: null, valorDeclaradoCentavos: 1500, seguimiento, tieneFoto: false, fotoRuta: null, avisado: false, recibidoEn: recibido ? '2026-11-18T10:00:00Z' : null };
}

function envio(sobre: Partial<Envio>): Envio {
  return {
    id: 'e',
    numero: 1,
    tipo: 'ALERTA',
    sinDueno: false,
    estado: 'PREALERTADO',
    etiquetaEstado: 'Prealertado',
    modalidad: 'M1',
    modalidadSugerida: null,
    transportista: 'MRW',
    tienda: 'Shein',
    valorDeclaradoCentavos: 3000,
    cliente: { id: 'c', nombre: 'Ana', telefono: '1', codigo: 'VENV-1', cedulaEnmascarada: 'V-***1' },
    paquetes: [],
    faltan: 0,
    pesoTotalKg: null,
    precio: null,
    tasa: null,
    entrega: { nombre: null, cedula: null, telefono: null, agencia: null, ciudad: null, estado: null },
    guia: { numero: null, tieneFoto: false, fotoRuta: null },
    pagos: [],
    pagadoCentavos: 0,
    creadoEn: '2026-11-17T10:00:00Z',
    actualizadoEn: '2026-11-17T10:00:00Z',
    ...sobre,
  } as Envio;
}

const PRECIO = { pesoCobrableKg: 4, precioPorKgCentavos: 950, fleteCentavos: 3800, seguroCentavos: 200, seguroManual: false, totalCentavos: 4000, totalBsCentavos: 3600000 };

const ENVIOS: Envio[] = [
  envio({ id: 'a1', numero: 3, estado: 'RECIBIDO_PARCIAL', paquetes: [paquete('p1', 'XC-0001', true), paquete('p2', 'XC-0002', false)] }),
  envio({
    id: 'c1',
    numero: 123,
    tipo: 'CONSOLIDADO',
    estado: 'DESPACHADO',
    etiquetaEstado: 'En ruta',
    precio: PRECIO,
    guia: { numero: 'MRW-555', tieneFoto: false, fotoRuta: null },
    paquetes: [
      paquete('p3', 'XC-0003', true, [
        { tipo: 'PREALERTADO', etiqueta: 'Prealertado', fecha: '2026-11-17T10:00:00Z' },
        { tipo: 'EN_OFICINA', etiqueta: 'En oficina', fecha: '2026-11-18T10:00:00Z' },
        { tipo: 'EN_RUTA', etiqueta: 'En ruta', fecha: '2026-11-20T10:00:00Z' },
      ]),
    ],
  }),
  envio({ id: 'c2', numero: 7, tipo: 'CONSOLIDADO', estado: 'CERRADO', etiquetaEstado: 'Entregado', precio: PRECIO, paquetes: [paquete('p4', 'XC-0004', true)] }),
  envio({ id: 'c3', numero: 9, tipo: 'CONSOLIDADO', estado: 'CANCELADO', etiquetaEstado: 'Descartado', paquetes: [] }),
];

function simularEnvios() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ envios: ENVIOS }), { status: 200 })));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('filas de Mis envíos', () => {
  it('caso feliz: Pre-alertas lista cada tracking y Activos cada consolidación con su número', () => {
    const pre = filasDePestana(ENVIOS, 'PREALERTAS');
    expect(pre.map((f) => [f.guia, f.estado])).toEqual(expect.arrayContaining([['XC-0001', 'En oficina'], ['XC-0002', 'Prealertado']]));
    expect(pre.find((f) => f.guia === 'XC-0002')?.eliminable).toBe(true);
    const activos = filasDePestana(ENVIOS, 'ACTIVOS');
    expect(activos.map((f) => f.guia)).toEqual(['Consolidación 000123']);
    expect(activos[0]!.totalCentavos).toBe(4000);
  });

  it('límite: Entregados solo trae los cerrados y nunca los descartados', () => {
    expect(filasDePestana(ENVIOS, 'ENTREGADOS').map((f) => f.guia)).toEqual(['Consolidación 000007']);
    expect(filasDePestana([], 'ACTIVOS')).toEqual([]);
  });
});

describe('rastrear', () => {
  it('caso feliz: por número de consolidación, con o sin ceros ni la palabra', () => {
    expect(rastrear(ENVIOS, '000123')?.envio.id).toBe('c1');
    expect(rastrear(ENVIOS, 'Consolidación 123')?.envio.id).toBe('c1');
  });

  it('caso feliz: por tracking encuentra el paquete y su envío; el historial va del más nuevo al más viejo', () => {
    const r = rastrear(ENVIOS, 'xc0003')!;
    expect(r.envio.id).toBe('c1');
    expect(r.paquete?.id).toBe('p3');
    expect(historialDe(r).map((h) => h.etiqueta)).toEqual(['En ruta', 'En oficina', 'Prealertado']);
  });

  it('error: un tracking ajeno, un descartado o una búsqueda vacía no devuelven nada', () => {
    expect(rastrear(ENVIOS, 'NOEXISTE')).toBeNull();
    expect(rastrear(ENVIOS, '9')).toBeNull();
    expect(rastrear(ENVIOS, '   ')).toBeNull();
  });
});

describe('pantalla Mis envíos', () => {
  it('caso feliz: las pestañas cambian la lista; sin bolívares, peso ni contenido; la guía lleva a Rastrear', async () => {
    simularEnvios();
    render(
      <MemoryRouter initialEntries={['/cuenta/mis-envios?pestana=ACTIVOS']}>
        <Routes>
          <Route path="/cuenta/mis-envios" element={<MisEnvios />} />
        </Routes>
      </MemoryRouter>,
    );
    const enlace = await screen.findByRole('link', { name: 'Consolidación 000123' });
    expect(enlace.getAttribute('href')).toBe('/cuenta/rastrear?q=000123');
    expect(screen.queryByText(/Bs/)).toBeNull();
    expect(screen.queryByText(/peso/i)).toBeNull();
    expect(screen.queryByText(/contenido/i)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Pre-alertas' }));
    expect(await screen.findByRole('link', { name: 'XC-0002' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /eliminar la alerta del tracking XC-0002/i })).toBeTruthy();
  });
});

describe('pantalla Rastrear', () => {
  it('caso feliz: muestra detalles con la guía y el historial con su explicación', async () => {
    simularEnvios();
    render(
      <MemoryRouter initialEntries={['/cuenta/rastrear?q=XC-0003']}>
        <Routes>
          <Route path="/cuenta/rastrear" element={<Rastrear />} />
        </Routes>
      </MemoryRouter>,
    );
    const titulo = await screen.findByRole('heading', { name: 'Historial' });
    const seccion = titulo.closest('section')!;
    expect(within(seccion).getByText('Recibimos tu paquete en nuestra oficina de Cúcuta.')).toBeTruthy();
    expect(screen.getByText('MRW-555')).toBeTruthy();
    expect(screen.getByText('Consolidación 000123')).toBeTruthy();
  });

  it('error: un número que no es del cliente dice que no hay información', async () => {
    simularEnvios();
    render(
      <MemoryRouter initialEntries={['/cuenta/rastrear?q=777777']}>
        <Routes>
          <Route path="/cuenta/rastrear" element={<Rastrear />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no encontramos información/i)).toBeTruthy();
  });
});
