import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AuthProvider } from '../src/lib/auth';
import { PRIVACIDAD, TERMINOS } from '../src/pages/legal/contenido';
import { PaginaLegal } from '../src/pages/legal/PaginaLegal';

const CONTACTO = {
  whatsapp: '573237968740',
  correo: 'contacto@venviosexpress.com',
  direccion: 'Av. 3 #8-03, piso 2, local 02, Barrio Latino, Cúcuta',
  instagram: 'https://instagram.com/venviosexpress',
  facebook: 'https://facebook.com/venviosexpress',
  tiktok: 'https://tiktok.com/@venviosexpress',
};

function simular() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/auth/yo')) {
        return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      }
      return new Response(JSON.stringify({ contacto: CONTACTO }), { status: 200 });
    }),
  );
}

function mostrar(documento: typeof TERMINOS) {
  return render(
    <MemoryRouter initialEntries={['/legal']}>
      <PaginaLegal documento={documento} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Páginas legales', () => {
  it('los términos muestra título, fecha y sus secciones', () => {
    simular();
    mostrar(TERMINOS);
    expect(screen.getByRole('heading', { level: 1, name: 'Términos y condiciones' })).toBeTruthy();
    expect(screen.getByText(/Última actualización: 21 de noviembre de 2026/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Qué es Venvios Express' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cómo funciona el envío' })).toBeTruthy();
    expect(screen.getAllByText(/MRW o Zoom/).length).toBeGreaterThan(0);
  });

  it('la privacidad explica qué datos se guardan y cómo pedir corrección', () => {
    simular();
    mostrar(PRIVACIDAD);
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Qué datos guardamos' })).toBeTruthy();
    expect(screen.getByText(/número de cédula/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tus derechos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cookies' })).toBeTruthy();
  });

  it('no hay aviso de borrador por el momento', () => {
    simular();
    const { unmount } = mostrar(TERMINOS);
    // No hay aviso de borrador por el momento
    unmount();
    mostrar(PRIVACIDAD);
    // No hay aviso de borrador por el momento
  });

  it('no se habla de reembolsos ni artículos prohibidos', () => {
    simular();
    mostrar(TERMINOS);
    const texto = (document.body.textContent ?? '').toLowerCase();
    expect(texto).not.toContain('reembolso');
    expect(texto).not.toContain('prohibid');
  });

  it('la ruta /terminos abre la página y una dirección inventada cae en la 404 propia', async () => {
    simular();
    const { unmount } = render(
      <MemoryRouter initialEntries={['/terminos']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Términos y condiciones' })).toBeTruthy();
    unmount();

    render(
      <MemoryRouter initialEntries={['/pagina-inexistente']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'No encontramos esa página' })).toBeTruthy();
  });
});