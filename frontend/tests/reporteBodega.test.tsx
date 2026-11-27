import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReporteBodega from '../src/pages/panel/ReporteBodega';

function respuestaJson(datos: unknown, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function respuestaInventario(clienteFiltro: { id: string; nombre: string; codigo: string } | null = null) {
  return {
    clienteFiltro,
    filtrosTexto: '',
    reporte: {
      tipo: 'inventario',
      generadoEn: '2026-11-27T12:00:00.000Z',
      periodo: { desde: null, hasta: null },
      resumen: {
        totalPaquetes: 2,
        pesoTotalKg: 4.5,
        sinAvisar: 1,
        porEtapa: { EN_BODEGA: 1, SIN_DUENO: 0, ESPERANDO_PAGO: 1, LISTO_PARA_SALIR: 0 },
      },
      clientes: [],
    },
  };
}

function respuestaEstadoCuenta() {
  return {
    clienteFiltro: { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' },
    filtrosTexto: '',
    reporte: {
      tipo: 'estado-de-cuenta',
      generadoEn: '2026-11-27T12:00:00.000Z',
      periodo: { desde: null, hasta: null },
      cliente: { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' },
      resumen: {
        totalPaquetes: 3,
        porEtapa: { POR_LLEGAR: 1, EN_BODEGA: 1, ESPERANDO_PAGO: 1, LISTO_PARA_SALIR: 0, EN_RUTA: 0, ENTREGADO: 0 },
        incluyeEntregados: false,
        sinRegistroPrealerta: 0,
      },
      prealertas: [],
      enBodega: [],
      consolidados: [],
      entregados: [],
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ReporteBodega (T-12, T-13, T-14)', () => {
  it('T-12: al cambiar de tipo cambian los filtros, las pastillas quitan filtros y los atajos llenan Desde y Hasta', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/staff/reportes/inventario')) return respuestaJson(respuestaInventario());
      if (url.startsWith('/api/staff/reportes/prealertas-pendientes')) {
        return respuestaJson({
          clienteFiltro: null,
          filtrosTexto: '',
          reporte: {
            tipo: 'prealertas-pendientes',
            generadoEn: '2026-11-27T12:00:00.000Z',
            periodo: { desde: null, hasta: null },
            resumen: { totalPrealertas: 1, totalPaquetesPorLlegar: 2, totalClientes: 1, sinRegistroPrealerta: 0 },
            clientes: [],
          },
        });
      }
      return respuestaJson({ error: { mensaje: 'No encontrado' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/panel/bodega/reporte']}>
        <ReporteBodega />
      </MemoryRouter>,
    );

    expect(await screen.findByText('4,50 kg')).toBeTruthy();
    expect(screen.getByLabelText('Etapa')).toBeTruthy();
    expect(screen.getByLabelText('Solo sin avisar')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 30 días' }));
    const desde = screen.getByLabelText('Desde') as HTMLInputElement;
    const hasta = screen.getByLabelText('Hasta') as HTMLInputElement;
    expect(desde.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hasta.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText(/Periodo:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Prealertas pendientes/ }));
    await waitFor(() => expect(screen.queryByLabelText('Etapa')).toBeNull());
    expect(screen.queryByLabelText('Solo sin avisar')).toBeNull();

    const quitarPeriodo = screen.getByRole('button', { name: /Quitar filtro: Periodo:/ });
    fireEvent.click(quitarPeriodo);
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Limpiar todo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 60 días' }));
    expect(screen.getByRole('button', { name: 'Limpiar todo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar todo' }));
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
  });

  it('T-12 y T-13: conserva estado desde la URL, bloquea estado de cuenta sin cliente y habilita enlace a Envíos con cliente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/staff/reportes/estado-de-cuenta')) return respuestaJson(respuestaEstadoCuenta());
        return respuestaJson(respuestaInventario());
      }),
    );

    const { unmount } = render(
      <MemoryRouter initialEntries={['/panel/bodega/reporte?tipo=estado-de-cuenta']}>
        <ReporteBodega />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Elige un cliente para ver su estado de cuenta/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Exportar Excel/ })).toHaveProperty('disabled', true);

    unmount();

    render(
      <MemoryRouter initialEntries={['/panel/bodega/reporte?tipo=estado-de-cuenta&clienteId=c1&desde=2026-11-01&hasta=2026-11-27']}>
        <ReporteBodega />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('VENV-000001')).toBeTruthy());
    expect(screen.getByRole('link', { name: /Ver su historial completo en Envíos/ }).getAttribute('href')).toBe('/panel/envios?estado=TODOS&q=VENV-000001');
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toHaveProperty('disabled', false);

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-28' } });
    expect(screen.getByText(/no puede ser posterior/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toHaveProperty('disabled', true);
  });

  it('T-14: descarga Excel y muestra error visible si la descarga falla por sesión vencida', async () => {
    const createObjectURLSpy = vi.fn(() => 'blob:prueba');
    const revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('.pdf')) return new Response(null, { status: 401 });
      if (url.includes('.xlsx')) {
        return new Response('excel', {
          status: 200,
          headers: { 'Content-Disposition': 'attachment; filename="inventario-2026-11-27.xlsx"' },
        });
      }
      return respuestaJson(respuestaInventario());
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/panel/bodega/reporte']}>
        <ReporteBodega />
      </MemoryRouter>,
    );

    await screen.findByText('4,50 kg');
    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }));
    await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/staff/reportes/inventario.xlsx',
      expect.objectContaining({ credentials: 'same-origin' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }));
    expect(await screen.findByText(/Tu sesión venció/)).toBeTruthy();
  });
});
