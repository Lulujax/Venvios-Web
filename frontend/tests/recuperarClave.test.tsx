import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validarCodigoCorreo } from '../src/lib/validar';
import { Ingresar } from '../src/pages/Acceso';
import { RecuperarClave } from '../src/pages/RecuperarClave';
import { AuthProvider } from '../src/lib/auth';

interface Llamada {
  url: string;
  cuerpo: Record<string, unknown>;
}

const llamadas: Llamada[] = [];

function simular(respuestas: Record<string, { estado: number; cuerpo?: unknown }>) {
  llamadas.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      if (url === '/api/auth/yo') return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as Record<string, unknown>) : {};
      llamadas.push({ url, cuerpo });
      const respuesta = respuestas[url] ?? { estado: 200, cuerpo: { ok: true } };
      return new Response(JSON.stringify(respuesta.cuerpo ?? { ok: true }), { status: respuesta.estado });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter>
      <RecuperarClave />
    </MemoryRouter>,
  );
}

function escribir(etiqueta: string | RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

async function pasarAlCodigo() {
  escribir('Correo electrónico', 'ana@correo.com');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByRole('heading', { name: 'Escribe el código' });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Recuperar contraseña con código', () => {
  it('caso feliz: correo, luego código y contraseña nueva, y al final vuelve a la entrada única', async () => {
    simular({});
    mostrar();
    await pasarAlCodigo();
    expect(llamadas[0]).toEqual({ url: '/api/auth/olvide-clave', cuerpo: { email: 'ana@correo.com' } });

    escribir('Código del correo', '123 456');
    escribir('Contraseña nueva', 'NuevaClave2026!');
    escribir('Repite la contraseña nueva', 'NuevaClave2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await screen.findByRole('heading', { name: 'Contraseña cambiada' });
    expect(llamadas[1]).toEqual({ url: '/api/auth/restablecer-clave', cuerpo: { email: 'ana@correo.com', codigo: '123456', nueva: 'NuevaClave2026!' } });
    expect(screen.getByRole('link', { name: 'Ir a ingresar' }).getAttribute('href')).toBe('/ingresar');
  });

  it('límite: una cuenta del personal usa la misma pantalla y termina en la entrada única', async () => {
    simular({});
    mostrar();
    escribir('Correo electrónico', 'operador@venvios.local');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Escribe el código' });
    escribir('Código del correo', '654321');
    escribir('Contraseña nueva', 'NuevaClave2026!');
    escribir('Repite la contraseña nueva', 'NuevaClave2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await screen.findByRole('heading', { name: 'Contraseña cambiada' });
    expect(llamadas[0]?.cuerpo).toEqual({ email: 'operador@venvios.local' });
    expect(screen.getByRole('link', { name: 'Ir a ingresar' }).getAttribute('href')).toBe('/ingresar');
  });

  it('error: un correo mal escrito no llama al servidor', async () => {
    simular({});
    mostrar();
    escribir('Correo electrónico', 'sin-arroba');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByText(/correo válido/)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });

  it('error: código mal formado, contraseña débil o repetición distinta no llaman al servidor', async () => {
    simular({});
    mostrar();
    await pasarAlCodigo();
    escribir('Código del correo', 'abc');
    escribir('Contraseña nueva', 'debil');
    escribir('Repite la contraseña nueva', 'otra');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Escribe el código de 6 números que te enviamos al correo.')).toBeTruthy();
    expect(screen.getByText('Usa al menos 8 caracteres, una mayúscula y un carácter especial.')).toBeTruthy();
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(llamadas.filter((l) => l.url.includes('restablecer'))).toHaveLength(0);
  });

  it('error: si el servidor rechaza el código muestra el mensaje y se queda en la misma pantalla', async () => {
    simular({ '/api/auth/restablecer-clave': { estado: 400, cuerpo: { error: { mensaje: 'El código es incorrecto o ya venció. Pide uno nuevo.' } } } });
    mostrar();
    await pasarAlCodigo();
    escribir('Código del correo', '000000');
    escribir('Contraseña nueva', 'NuevaClave2026!');
    escribir('Repite la contraseña nueva', 'NuevaClave2026!');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText(/incorrecto o ya venció/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Contraseña cambiada' })).toBeNull();
  });

  it('error: si no se pudo enviar el correo muestra el aviso y no avanza', async () => {
    simular({ '/api/auth/olvide-clave': { estado: 503, cuerpo: { error: { mensaje: 'No pudimos enviar el código. Escríbenos por WhatsApp y te ayudamos.' } } } });
    mostrar();
    escribir('Correo electrónico', 'ana@correo.com');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByText(/Escríbenos por WhatsApp/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Escribe el código' })).toBeNull();
  });

  it('caso feliz: «pide otro código» vuelve a pedir el correo', async () => {
    simular({});
    mostrar();
    await pasarAlCodigo();
    fireEvent.click(screen.getByRole('button', { name: 'pide otro código' }));
    expect(await screen.findByRole('heading', { name: 'Recupera tu contraseña' })).toBeTruthy();
  });
});

describe('enlace «¿Olvidaste tu contraseña?» en la entrada única', () => {
  it('caso feliz: lleva a /recuperar', async () => {
    simular({});
    render(
      <MemoryRouter>
        <AuthProvider>
          <Ingresar />
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).getAttribute('href')).toBe('/recuperar'));
  });
});

describe('validarCodigoCorreo', () => {
  it('caso feliz y límites: acepta 6 a 10 números con espacios', () => {
    expect(validarCodigoCorreo('123 456')).toBeNull();
    expect(validarCodigoCorreo('1234567890')).toBeNull();
  });

  it('error: rechaza letras, vacío, muy corto y muy largo', () => {
    for (const malo of ['abc123', '', '12345', '12345678901']) expect(validarCodigoCorreo(malo)).toMatch(/código de 6 números/);
  });
});
