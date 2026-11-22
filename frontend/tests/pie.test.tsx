import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Pie } from '../src/components/Pie';
import type { Contacto } from '../src/lib/tipos';

const CONTACTO: Contacto = {
  whatsapp: '573237968740',
  correo: 'contacto@venviosexpress.com',
  direccion: 'Av. 3 #8-03, piso 2, local 02, Barrio Latino, Cúcuta',
  horario: 'Lunes a sábado, 8:00 am a 5:00 pm (hora Colombia), horario continuo. Domingos y feriados no laboramos.',
  instagram: 'https://instagram.com/venviosexpress',
  facebook: 'https://facebook.com/venviosexpress',
  tiktok: 'https://tiktok.com/@venviosexpress',
};

const INTERNOS = new Set([
  '/',
  '/registro',
  '/terminos',
  '/privacidad',
  '#tarifas',
  '#calculadora',
  '#rastreo',
  '#como-funciona',
  '#contacto',
]);

function mostrar(entrada = '/', contacto: Contacto | null = CONTACTO) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Pie contacto={contacto} />
    </MemoryRouter>,
  );
}

describe('Pie de página', () => {
  it('caso feliz: muestra las cuatro columnas, la marca y el contacto configurado', () => {
    mostrar();
    for (const titulo of ['Servicios', 'Ayuda', 'Legal y pagos']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeTruthy();
    }
    expect(screen.getByText(CONTACTO.direccion)).toBeTruthy();
    expect(screen.getByRole('link', { name: /contacto@venviosexpress\.com/ }).getAttribute('href')).toBe(`mailto:${CONTACTO.correo}`);
    expect(screen.getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe(CONTACTO.instagram);
  });

  it('el año del copyright se calcula solo', () => {
    mostrar();
    expect(screen.getByText(/© \d{4} Venvios Express/)).toBeTruthy();
  });

  it('el crédito abre el sitio de Lulujax en una pestaña nueva y sin acceso a la página', () => {
    mostrar();
    const credito = screen.getByRole('link', { name: 'Lulujax' });
    expect(credito.getAttribute('href')).toBe('https://lulujax.netlify.app/');
    expect(credito.getAttribute('target')).toBe('_blank');
    expect(credito.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('el WhatsApp usa el número de la configuración', () => {
    mostrar();
    const enlace = screen.getByRole('link', { name: 'WhatsApp de atención' });
    expect(enlace.getAttribute('href')).toContain('https://wa.me/573237968740?text=');
    expect(screen.getByRole('link', { name: /Escríbenos por WhatsApp/ }).getAttribute('href')).toContain('https://wa.me/573237968740?text=');
  });

  it('no enlaza al panel del personal ni a páginas que no existen', () => {
    mostrar();
    const enlaces = screen.getAllByRole('link');
    expect(enlaces.some((a) => (a.getAttribute('href') ?? '').startsWith('/admin'))).toBe(false);
    expect(screen.queryByText(/Acceso del personal/)).toBeNull();
    const internos = enlaces
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('http') && !href.startsWith('mailto:'));
    for (const href of internos) expect(INTERNOS.has(href)).toBe(true);
  });

  it('los enlaces externos abren en pestaña nueva y sin acceso a la página', () => {
    mostrar();
    const externos = screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('http'));
    expect(externos.length).toBeGreaterThan(0);
    for (const enlace of externos) {
      expect(enlace.getAttribute('target')).toBe('_blank');
      expect(enlace.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('desde una página legal las secciones de la portada se enlazan con la ruta completa', () => {
    mostrar('/terminos');
    expect(screen.getByRole('link', { name: 'Tarifas' }).getAttribute('href')).toBe('/#tarifas');
    expect(screen.getByRole('link', { name: 'Cómo funciona' }).getAttribute('href')).toBe('/#como-funciona');
    expect(screen.getByRole('link', { name: 'Calcula tu envío' }).getAttribute('href')).toBe('/#calculadora');
  });

  it('caso feliz: muestra el horario de atención de la configuración (RF-23)', () => {
    mostrar();
    expect(screen.getByText(CONTACTO.horario)).toBeTruthy();
  });

  it('límite: con el horario vacío no muestra la línea del horario (RF-24)', () => {
    mostrar('/', { ...CONTACTO, horario: '' });
    expect(screen.queryByText(/Lunes a sábado/)).toBeNull();
    expect(screen.getByText(CONTACTO.direccion)).toBeTruthy();
  });

  it('límite: sin datos de contacto sigue mostrando el pie y el crédito', () => {
    mostrar('/', null);
    expect(screen.getByRole('heading', { name: 'Servicios' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lulujax' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Instagram' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Escríbenos por WhatsApp/ })).toBeNull();
  });
});
