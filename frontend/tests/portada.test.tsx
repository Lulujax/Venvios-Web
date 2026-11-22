import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/lib/auth';
import type { Contacto, InfoPublica } from '../src/lib/tipos';
import Landing from '../src/pages/Landing';

const HORARIO = 'Lunes a sábado, 8:00 am a 5:00 pm (hora Colombia), horario continuo. Domingos y feriados no laboramos.';

const CONTACTO: Contacto = {
  whatsapp: '573237968740',
  correo: 'contacto@venviosexpress.com',
  direccion: 'Av. 3 #8-03, piso 2, local 02, Barrio Latino, Cúcuta',
  horario: HORARIO,
  instagram: 'https://instagram.com/venviosexpress',
  facebook: 'https://facebook.com/venviosexpress',
  tiktok: 'https://tiktok.com/@venviosexpress',
};

function info(contacto: Contacto): InfoPublica {
  return {
    tarifas: {
      m1Tramos: [{ desdeKg: 0, precioPorKgCentavos: 900 }],
      m1SeguroPorcentaje: 5,
      m1PesoMinimoKg: 1,
      m2PrecioPorKgCentavos: 600,
      m2SeguroPorcentaje: 5,
      m2PesoMinimoKg: 1,
    },
    transportistas: [],
    contacto,
    tasa: null,
  } as unknown as InfoPublica;
}

function simular(contacto: Contacto) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/auth/yo')) return new Response(JSON.stringify({ error: { mensaje: 'sin sesión' } }), { status: 401 });
      return new Response(JSON.stringify(info(contacto)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Landing />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('portada: lema y horario (spec 003, RF-23, RF-24, RF-26)', () => {
  it('caso feliz: muestra el lema encima del título y el horario en la sección de contacto', async () => {
    simular(CONTACTO);
    const { container } = mostrar();
    const lema = screen.getByText('Tu mejor opción');
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(lema.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const contacto = container.querySelector('#contacto') as HTMLElement;
    expect(await within(contacto).findByText(HORARIO)).toBeTruthy();
  });

  it('límite: con el horario vacío no aparece en la sección de contacto', async () => {
    simular({ ...CONTACTO, horario: '' });
    const { container } = mostrar();
    const contacto = container.querySelector('#contacto') as HTMLElement;
    expect(await within(contacto).findByText(CONTACTO.direccion)).toBeTruthy();
    expect(within(contacto).queryByText(/Lunes a sábado/)).toBeNull();
  });

  it('error: si la información no carga, el lema sigue visible y no se muestra ningún horario', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { mensaje: 'caído' } }), { status: 500 })));
    const { container } = mostrar();
    expect(screen.getByText('Tu mejor opción')).toBeTruthy();
    expect(await within(container.querySelector('#contacto') as HTMLElement).findByText(/Barrio Latino, Cúcuta/)).toBeTruthy();
    expect(screen.queryByText(/Lunes a sábado/)).toBeNull();
  });
});
