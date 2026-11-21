import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumenEntregaPerfil } from '../src/components/envio/ResumenEntrega';
import { AuthProvider } from '../src/lib/auth';
import { separarTelefono } from '../src/lib/telefono';
import type { PerfilVista } from '../src/lib/tipos';
import { Perfil } from '../src/pages/cliente/Perfil';

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: Record<string, unknown> | null;
}

function enrutar(rutas: Record<string, unknown>, llamadas: Llamada[]) {
  return vi.fn(async (url: string, opciones?: RequestInit) => {
    const metodo = opciones?.method ?? 'GET';
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as Record<string, unknown>) : null;
    llamadas.push({ url, metodo, cuerpo });
    const respuesta = rutas[`${metodo} ${url}`];
    if (respuesta === undefined) return new Response(JSON.stringify({ error: { mensaje: `Sin ruta de prueba: ${metodo} ${url}` } }), { status: 404 });
    return new Response(JSON.stringify(respuesta), { status: 200 });
  });
}

function crearPerfil(sobrescribir: Partial<PerfilVista['entrega']> = {}): PerfilVista {
  return {
    datos: {
      id: 'cli-1',
      nombre: 'Ana Prueba Rojas',
      email: 'ana.prueba1@ejemplo.com',
      codigo: 'VENV-123456',
      telefono: '573001110001',
      cedulaEnmascarada: 'V-***101',
      rol: 'CLIENTE',
      activo: true,
      debeCambiarClave: false,
    },
    entrega: {
      receptor: null,
      receptorPorDefecto: { nombre: 'Ana Prueba Rojas', cedula: '20000101', telefono: '573001110001' },
      destinos: { MRW: null, ZOOM: null },
      completo: { MRW: false, ZOOM: false },
      ...sobrescribir,
    },
  };
}

const RUTAS_BASE = {
  'GET /api/auth/yo': { usuario: crearPerfil().datos },
  'GET /api/publico/info': { contacto: { whatsapp: '573000000000' } },
};

function mostrarPerfil(perfil: PerfilVista, llamadas: Llamada[], extra: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', enrutar({ ...RUTAS_BASE, 'GET /api/perfil': perfil, ...extra }, llamadas));
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Perfil />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('separar el teléfono en país y número', () => {
  it('caso feliz: reconoce Venezuela y Colombia', () => {
    expect(separarTelefono('584241234567')).toEqual({ pais: 'VE', numero: '4241234567' });
    expect(separarTelefono('573001234567')).toEqual({ pais: 'CO', numero: '3001234567' });
  });

  it('límite: un prefijo de un solo dígito se reconoce y uno largo gana al corto', () => {
    expect(separarTelefono('13055551234')).toEqual({ pais: 'US', numero: '3055551234' });
    expect(separarTelefono('593991234567')).toEqual({ pais: 'EC', numero: '991234567' });
  });

  it('error: un prefijo desconocido queda con Venezuela y el número completo', () => {
    expect(separarTelefono('999123456789')).toEqual({ pais: 'VE', numero: '999123456789' });
  });
});

describe('Perfil del cliente', () => {
  it('caso feliz: muestra casillero y cédula parcial, sin pedir ninguna foto', async () => {
    mostrarPerfil(crearPerfil(), []);
    expect(await screen.findByText('VENV-123456')).toBeTruthy();
    expect(screen.getByText('V-***101')).toBeTruthy();
    expect(screen.getByText(/no se cambia aquí/i)).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByLabelText(/cédula nueva/i)).toBeNull();
  });

  it('caso feliz: guarda MRW y deja Zoom vacío, retirando el propio cliente', async () => {
    const llamadas: Llamada[] = [];
    mostrarPerfil(crearPerfil(), llamadas, { 'PUT /api/perfil/entrega': crearPerfil({ completo: { MRW: true, ZOOM: false } }) });
    await screen.findByText('VENV-123456');
    fireEvent.change(screen.getByLabelText(/agencia de MRW/i), { target: { value: 'MRW Chacao' } });
    fireEvent.change(screen.getByLabelText('Ciudad', { selector: 'input' }), { target: { value: 'Caracas' } });
    const estados = screen.getAllByLabelText('Estado');
    fireEvent.change(estados[0]!, { target: { value: 'Miranda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos de entrega' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT' && l.url === '/api/perfil/entrega')).toBe(true));
    const envio = llamadas.find((l) => l.metodo === 'PUT' && l.url === '/api/perfil/entrega')!.cuerpo!;
    expect(envio.receptor).toBeNull();
    expect(envio.MRW).toEqual({ agencia: 'MRW Chacao', ciudad: 'Caracas', estado: 'Miranda' });
    expect(envio.ZOOM).toEqual({ agencia: '', ciudad: '', estado: '' });
  });

  it('error: una transportista a medias no se envía y explica qué falta', async () => {
    const llamadas: Llamada[] = [];
    mostrarPerfil(crearPerfil(), llamadas);
    await screen.findByText('VENV-123456');
    fireEvent.change(screen.getByLabelText(/agencia de MRW/i), { target: { value: 'MRW Chacao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos de entrega' }));
    expect(await screen.findByText(/completa la agencia, la ciudad y el estado/i)).toBeTruthy();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });

  it('error: cambiar el correo sin la contraseña actual no se envía', async () => {
    const llamadas: Llamada[] = [];
    mostrarPerfil(crearPerfil(), llamadas);
    await screen.findByText('VENV-123456');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'otro@correo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' }));
    expect(await screen.findByText(/para confirmar el cambio/i)).toBeTruthy();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });

  it('límite: cambiar solo el nombre se guarda sin pedir contraseña', async () => {
    const llamadas: Llamada[] = [];
    mostrarPerfil(crearPerfil(), llamadas, { 'PUT /api/perfil/datos': crearPerfil() });
    await screen.findByText('VENV-123456');
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Ana Maria Rojas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PUT' && l.url === '/api/perfil/datos')).toBe(true));
    const cuerpo = llamadas.find((l) => l.url === '/api/perfil/datos')!.cuerpo!;
    expect(cuerpo.nombre).toBe('Ana Maria Rojas');
    expect(cuerpo.contrasenaActual).toBeUndefined();
  });
});

describe('Resumen de entrega al consolidar', () => {
  it('error: con el perfil incompleto avisa y lleva a completarlo', () => {
    render(
      <MemoryRouter>
        <ResumenEntregaPerfil perfil={crearPerfil()} transportista="MRW" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/falta tu dirección de entrega de mrw/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Completar mi perfil' }).getAttribute('href')).toBe('/cuenta/perfil');
  });

  it('caso feliz: con el perfil completo muestra quién retira y «Cambiar en mi perfil»', () => {
    const perfil = crearPerfil({ destinos: { MRW: { agencia: 'MRW Chacao', ciudad: 'Caracas', estado: 'Miranda' }, ZOOM: null }, completo: { MRW: true, ZOOM: false } });
    render(
      <MemoryRouter>
        <ResumenEntregaPerfil perfil={perfil} transportista="MRW" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/retira: ana prueba rojas/i)).toBeTruthy();
    expect(screen.getByText(/mrw chacao/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cambiar en mi perfil' })).toBeTruthy();
  });

  it('límite: sin perfil cargado no muestra nada', () => {
    const { container } = render(
      <MemoryRouter>
        <ResumenEntregaPerfil perfil={null} transportista="ZOOM" />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });
});
