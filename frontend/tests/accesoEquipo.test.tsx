import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ambitoDeRuta, rutaEntrada, rutaLogin } from '../src/lib/ambito';
import { AuthProvider } from '../src/lib/auth';
import { Ingresar } from '../src/pages/Acceso';

const llamadas: Array<{ url: string; cabecera: string | null }> = [];

function simular(rol: 'OPERADOR' | 'CLIENTE' = 'OPERADOR') {
  llamadas.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const cabeceras = (opciones?.headers ?? {}) as Record<string, string>;
      llamadas.push({ url, cabecera: cabeceras['X-Ambito'] ?? null });
      if (url.endsWith('/auth/yo')) return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      return new Response(JSON.stringify({ usuario: { id: 'u1', rol, nombre: 'Prueba', debeCambiarClave: false } }), { status: 200 });
    }),
  );
}

function mostrarEquipo() {
  return render(
    <MemoryRouter initialEntries={['/equipo']}>
      <AuthProvider>
        <Routes>
          <Route path="/equipo" element={<Ingresar equipo />} />
          <Route path="/panel" element={<p>Inicio del panel</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

describe('ámbito de la web', () => {
  it('caso feliz: las rutas del panel y del equipo son del ámbito equipo', () => {
    expect(ambitoDeRuta('/panel')).toBe('equipo');
    expect(ambitoDeRuta('/panel/envios/3')).toBe('equipo');
    expect(ambitoDeRuta('/equipo')).toBe('equipo');
    expect(ambitoDeRuta('/equipo/recuperar')).toBe('equipo');
  });

  it('límite: la cuenta, la entrada de clientes y rutas parecidas son del ámbito cliente', () => {
    expect(ambitoDeRuta('/')).toBe('cliente');
    expect(ambitoDeRuta('/cuenta/mis-envios')).toBe('cliente');
    expect(ambitoDeRuta('/ingresar')).toBe('cliente');
    expect(ambitoDeRuta('/paneles')).toBe('cliente');
    expect(ambitoDeRuta('/equipos')).toBe('cliente');
  });

  it('error: una ruta que no es texto se rechaza', () => {
    expect(() => ambitoDeRuta(undefined as unknown as string)).toThrow();
  });

  it('cada ámbito tiene su ruta de login y su pantalla de entrada', () => {
    expect(rutaLogin('cliente')).toBe('/auth/login');
    expect(rutaLogin('equipo')).toBe('/equipo/auth/login');
    expect(rutaEntrada('cliente')).toBe('/ingresar');
    expect(rutaEntrada('equipo')).toBe('/equipo');
  });
});

describe('ingreso del equipo', () => {
  it('caso feliz: el personal entra por la ruta del equipo y va al panel', async () => {
    window.history.pushState({}, '', '/equipo');
    simular('OPERADOR');
    mostrarEquipo();
    expect(screen.getByRole('heading', { name: 'Ingreso del equipo' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Correo o número de casillero'), { target: { value: 'omar@correo.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Inicio del panel')).toBeTruthy();
    const login = llamadas.find((l) => l.url === '/api/equipo/auth/login');
    expect(login, 'no se llamó al login del equipo').toBeDefined();
    expect(login?.cabecera).toBe('equipo');
  });

  it('límite: la pantalla del equipo no ofrece crear una cuenta', () => {
    window.history.pushState({}, '', '/equipo');
    simular();
    mostrarEquipo();
    expect(screen.queryByText(/Crea tu casillero/)).toBeNull();
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).getAttribute('href')).toBe('/equipo/recuperar');
  });

  it('error: con datos vacíos no se llama al servidor', () => {
    window.history.pushState({}, '', '/equipo');
    simular();
    mostrarEquipo();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(llamadas.some((l) => l.url.includes('/auth/login'))).toBe(false);
  });
});
