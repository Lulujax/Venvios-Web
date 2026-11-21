import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/lib/auth';
import { Ingresar } from '../src/pages/Acceso';

const cuerpos: Array<Record<string, unknown>> = [];

function simular(estadoLogin = 403) {
  cuerpos.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      if (url === '/api/auth/yo') return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      if (typeof opciones?.body === 'string') cuerpos.push(JSON.parse(opciones.body) as Record<string, unknown>);
      return new Response(JSON.stringify({ error: { mensaje: 'El personal entra por /admin' } }), { status: estadoLogin });
    }),
  );
}

function mostrar(personal: boolean) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Ingresar personal={personal} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Entradas separadas', () => {
  it('caso feliz: la entrada del personal tiene su título y manda portal PERSONAL', async () => {
    simular();
    mostrar(true);
    expect(await screen.findByRole('heading', { name: 'Entrada del personal' })).toBeTruthy();
    expect(screen.queryByText(/crea tu casillero/i)).toBeNull();
    fireEvent.change(screen.getByLabelText('Correo del personal'), { target: { value: 'op@venvios.local' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(cuerpos.at(-1)?.portal).toBe('PERSONAL'));
  });

  it('límite: la entrada de clientes manda portal CLIENTE y ofrece crear casillero', async () => {
    simular();
    mostrar(false);
    expect(await screen.findByText(/crea tu casillero/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Correo o número de casillero'), { target: { value: 'ana@correo.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(cuerpos.at(-1)?.portal).toBe('CLIENTE'));
  });

  it('error: si el servidor rechaza por entrada equivocada muestra a dónde ir', async () => {
    simular(403);
    mostrar(false);
    await screen.findByText(/crea tu casillero/i);
    fireEvent.change(screen.getByLabelText('Correo o número de casillero'), { target: { value: 'op@venvios.local' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('El personal entra por /admin')).toBeTruthy();
  });
});
