import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PieTandas, useTandas } from '../src/components/Tandas';
import { AuthProvider } from '../src/lib/auth';
import { coincideTracking } from '../src/lib/cuenta';
import { Consolidar } from '../src/pages/cliente/Consolidar';

function Lista({ cantidad }: { cantidad: number }) {
  const items = Array.from({ length: cantidad }, (_, i) => `Item ${i + 1}`);
  const tandas = useTandas(items);
  return (
    <div>
      <ul>
        {tandas.visibles.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
    </div>
  );
}

function paqueteDe(indice: number, prefijo: string) {
  return {
    id: `${prefijo}-${indice}`,
    tracking: `${prefijo}${String(indice).padStart(4, '0')}`,
    recibido: true,
    pesoKg: null,
    valorDeclaradoCentavos: 1000,
    seguimiento: [],
    tieneFoto: false,
    fotoRuta: null,
    avisado: false,
    recibidoEn: '2026-11-20T10:00:00Z',
  };
}

function alertaCon(paquetes: ReturnType<typeof paqueteDe>[]) {
  return {
    id: 'alerta-1',
    tipo: 'ALERTA',
    estado: 'RECIBIDO_COMPLETO',
    tienda: 'Shein',
    valorDeclaradoCentavos: paquetes.length * 1000,
    paquetes,
    creadoEn: '2026-11-19T10:00:00Z',
  };
}

function servidor(envios: unknown[]) {
  const perfil = {
    datos: { id: 'c1', nombre: 'Ana', email: 'a@a.com', codigo: 'VENV-1', telefono: '573001110001', cedulaEnmascarada: 'V-***101', rol: 'CLIENTE', activo: true, debeCambiarClave: false },
    entrega: { receptor: null, receptorPorDefecto: { nombre: 'Ana', cedula: '1', telefono: '1' }, destinos: { MRW: null, ZOOM: null }, completo: { MRW: false, ZOOM: false } },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const rutas: Record<string, unknown> = {
        '/api/envios': { envios },
        '/api/perfil': perfil,
        '/api/auth/yo': { usuario: perfil.datos },
        '/api/publico/info': { contacto: { whatsapp: '573000000000' } },
      };
      return new Response(JSON.stringify(rutas[url] ?? {}), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Listas de 10 en 10', () => {
  it('caso feliz: muestra 10, el contador y «Ver 10 más» hasta llegar al final', () => {
    render(<Lista cantidad={25} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Mostrando 10 de 25')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver 10 más' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Ver 10 más' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
    expect(screen.getByText('Mostrando 25 de 25')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver 10 más' })).toBeNull();
  });

  it('límite: con 10 o menos no aparece ni el contador ni el botón', () => {
    render(<Lista cantidad={10} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByText(/mostrando/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /ver 10 más/i })).toBeNull();
  });

  it('límite: una lista vacía no muestra nada extra', () => {
    render(<Lista cantidad={0} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText(/mostrando/i)).toBeNull();
  });

  it('el buscador compara sin guiones ni mayúsculas', () => {
    expect(coincideTracking('XC-000123', 'xc000')).toBe(true);
    expect(coincideTracking('XC-000123', '')).toBe(true);
    expect(coincideTracking('XC-000123', 'zzz')).toBe(false);
  });
});

describe('Consolidar del cliente con muchos paquetes', () => {
  it('caso feliz: ve 10, busca entre todos y «Elegir» marca todos los que coinciden, no solo los visibles', async () => {
    const paquetes = [...Array.from({ length: 13 }, (_, i) => paqueteDe(i + 1, 'LOTEA')), ...Array.from({ length: 12 }, (_, i) => paqueteDe(i + 1, 'LOTEB'))];
    servidor([alertaCon(paquetes)]);
    render(
      <MemoryRouter>
        <AuthProvider>
          <Consolidar />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Mostrando 10 de 25')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(10);
    fireEvent.change(screen.getByLabelText('Buscar por tracking'), { target: { value: 'LOTEA' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Elegir los 13 que coinciden' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Elegir los 13 que coinciden' }));
    expect(screen.getByText('13 paquete(s) elegidos')).toBeTruthy();
    expect(screen.getByText('130,00 $')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar todos' }));
    expect(screen.getByText('Todavía no elegiste paquetes.')).toBeTruthy();
  });

  it('error: una búsqueda sin resultados lo dice y no deja elegir nada', async () => {
    servidor([alertaCon(Array.from({ length: 12 }, (_, i) => paqueteDe(i + 1, 'LOTEA')))]);
    render(
      <MemoryRouter>
        <AuthProvider>
          <Consolidar />
        </AuthProvider>
      </MemoryRouter>,
    );
    await screen.findByText('Mostrando 10 de 12');
    fireEvent.change(screen.getByLabelText('Buscar por tracking'), { target: { value: 'NOEXISTE' } });
    expect(await screen.findByText('Ningún paquete coincide con esa búsqueda.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /elegir/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
