import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/lib/auth';
import { Ingresar } from '../src/pages/Acceso';

const cuerpos: Array<Record<string, unknown>> = [];

interface Simulacion {
  estadoLogin?: number;
  rol?: 'CLIENTE' | 'OPERADOR' | 'ADMIN';
}

function simular({ estadoLogin = 200, rol = 'CLIENTE' }: Simulacion = {}) {
  cuerpos.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      if (url === '/api/auth/yo') return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      if (typeof opciones?.body === 'string') cuerpos.push(JSON.parse(opciones.body) as Record<string, unknown>);
      if (estadoLogin !== 200) return new Response(JSON.stringify({ error: { mensaje: 'Correo, número de casillero o contraseña incorrectos.' } }), { status: estadoLogin });
      return new Response(JSON.stringify({ usuario: { id: 'u1', rol, nombre: 'Prueba', debeCambiarClave: false } }), { status: 200 });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter initialEntries={['/ingresar']}>
      <AuthProvider>
        <Routes>
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/cuenta" element={<p>Inicio del cliente</p>} />
          <Route path="/panel" element={<p>Inicio del panel</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function entrar(identificador: string) {
  fireEvent.change(screen.getByLabelText('Correo o número de casillero'), { target: { value: identificador } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Entrada única (RF-120)', () => {
  it('caso feliz: un cliente entra y va a su cuenta, sin mandar ningún portal', async () => {
    simular({ rol: 'CLIENTE' });
    mostrar();
    entrar('ana@correo.com');
    expect(await screen.findByText('Inicio del cliente')).toBeTruthy();
    expect(cuerpos.at(-1)).toEqual({ identificador: 'ana@correo.com', contrasena: 'Clave2026!' });
  });

  it('caso feliz: un operador entra por el mismo formulario y va al panel', async () => {
    simular({ rol: 'OPERADOR' });
    mostrar();
    entrar('op@venvios.local');
    expect(await screen.findByText('Inicio del panel')).toBeTruthy();
  });

  it('caso feliz: un administrador también va al panel', async () => {
    simular({ rol: 'ADMIN' });
    mostrar();
    entrar('admin@venvios.local');
    expect(await screen.findByText('Inicio del panel')).toBeTruthy();
  });

  it('límite: ofrece crear casillero y no muestra ninguna entrada aparte para el personal', async () => {
    simular();
    mostrar();
    expect(await screen.findByText(/crea tu casillero/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeTruthy();
    expect(screen.queryByText(/personal/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });

  it('error: con datos incorrectos muestra el mismo mensaje y se queda en la pantalla', async () => {
    simular({ estadoLogin: 401 });
    mostrar();
    await screen.findByText(/crea tu casillero/i);
    entrar('op@venvios.local');
    expect(await screen.findByText('Correo, número de casillero o contraseña incorrectos.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Inicio del panel')).toBeNull());
  });
});
