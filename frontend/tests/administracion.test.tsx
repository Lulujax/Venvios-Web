import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorConfirmar } from '../src/components/Confirmar';
import { ProveedorAvisos } from '../src/components/ui';
import type { Usuario } from '../src/lib/tipos';
import { FILTROS_INICIALES, contarUsuarios, filtrarUsuarios } from '../src/lib/usuarios';
import Administracion from '../src/pages/panel/Administracion';

vi.mock('../src/lib/auth', () => ({ useAuth: () => ({ usuario: { id: 'u-admin', rol: 'ADMIN' } }) }));

function persona(id: string, nombre: string, extra: Partial<Usuario> = {}): Usuario {
  return { id, nombre, email: `${id}@venvios.test`, codigo: id, telefono: '573000000000', cedulaEnmascarada: '***', rol: 'OPERADOR', activo: true, debeCambiarClave: false, ...extra };
}

const PERSONAL: Usuario[] = [
  persona('u-admin', 'Luis Administrador', { rol: 'ADMIN' }),
  persona('u-ana', 'Ana Pérez'),
  persona('u-jose', 'José Núñez', { debeCambiarClave: true }),
  persona('u-mar', 'María Gómez', { activo: false }),
  persona('u-pedro', 'Pedro Ramos', { rol: 'ADMIN', debeCambiarClave: true }),
];

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: unknown;
}

let llamadas: Llamada[] = [];

function simular(opciones: { usuarios?: Usuario[]; tasaVieja?: boolean; pagoDePrueba?: boolean; falla?: boolean } = {}) {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, pedido?: RequestInit) => {
      const metodo = pedido?.method ?? 'GET';
      const cuerpo = typeof pedido?.body === 'string' ? JSON.parse(pedido.body) : null;
      llamadas.push({ url, metodo, cuerpo });
      const responder = (datos: unknown, estado = 200) => new Response(JSON.stringify(datos), { status: estado });
      if (url === '/api/admin/usuarios' && metodo === 'GET') {
        if (opciones.falla) return responder({ error: { mensaje: 'Se cayó la conexión con el servidor.' } }, 500);
        return responder({ usuarios: opciones.usuarios ?? PERSONAL });
      }
      if (url.startsWith('/api/admin/usuarios/') && metodo === 'PATCH') return responder({ usuario: {} });
      if (url === '/api/admin/estadisticas/usuarios') return responder({ clientes: 12, clientesNuevos7Dias: 3, operadores: 2, administradores: 2, total: 16 });
      if (url === '/api/admin/tasa') return responder({ tasa: { bolivaresPorUsd: 917.7751, fecha: '2026-11-22', fuente: 'API', desactualizada: opciones.tasaVieja ?? false } });
      if (url === '/api/admin/config/datosPago') return responder({ valor: { esPrueba: opciones.pagoDePrueba ?? false } });
      return responder({ error: { mensaje: 'Ruta sin preparar' } }, 404);
    }),
  );
}

function mostrar(ruta = '/panel/admin') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAvisos>
        <ProveedorConfirmar>
          <Administracion />
        </ProveedorConfirmar>
      </ProveedorAvisos>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('filtros del personal (RF-171)', () => {
  it('caso feliz: sin filtros devuelve todos y cuenta por estado y rol solo entre los activos', () => {
    expect(filtrarUsuarios(PERSONAL, FILTROS_INICIALES)).toHaveLength(5);
    expect(contarUsuarios(PERSONAL)).toEqual({ todos: 5, activos: 4, inactivos: 1, pendientes: 2, operadores: 2, administradores: 2 });
  });

  it('límite: busca sin importar tildes ni mayúsculas, por nombre o por correo', () => {
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, texto: 'JOSE NUNEZ' }).map((u) => u.id)).toEqual(['u-jose']);
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, texto: 'u-pedro@' }).map((u) => u.id)).toEqual(['u-pedro']);
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, texto: '  ' })).toHaveLength(5);
  });

  it('límite: «sin cambiar clave» no incluye a los inactivos y rol + estado se combinan', () => {
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, estado: 'PENDIENTES' }).map((u) => u.id)).toEqual(['u-jose', 'u-pedro']);
    expect(filtrarUsuarios(PERSONAL, { texto: '', rol: 'ADMIN', estado: 'PENDIENTES' }).map((u) => u.id)).toEqual(['u-pedro']);
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, estado: 'INACTIVOS' }).map((u) => u.id)).toEqual(['u-mar']);
  });

  it('error: una búsqueda sin coincidencias devuelve lista vacía y una lista vacía no rompe los contadores', () => {
    expect(filtrarUsuarios(PERSONAL, { ...FILTROS_INICIALES, texto: 'zzz' })).toEqual([]);
    expect(contarUsuarios([])).toEqual({ todos: 0, activos: 0, inactivos: 0, pendientes: 0, operadores: 0, administradores: 0 });
  });
});

describe('Administración: resumen y menú (RF-169, RF-170)', () => {
  it('caso feliz: abre en el resumen con las cuatro tarjetas y los números del personal', async () => {
    simular();
    mostrar();
    expect(await screen.findByText('Personal activo')).toBeTruthy();
    expect(screen.getByText('2 operadores · 2 administradores')).toBeTruthy();
    expect(screen.getByText('Clientes registrados')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3 nuevos en los últimos 7 días')).toBeTruthy();
    expect(screen.getByText('Tasa BCV', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Reales')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resumen', selected: true })).toBeTruthy();
  });

  it('caso feliz: la tarjeta «Clientes registrados» abre la sección Clientes', async () => {
    simular();
    mostrar();
    fireEvent.click(await screen.findByRole('button', { name: /Clientes registrados/ }));
    expect(await screen.findByRole('tab', { name: 'Clientes', selected: true })).toBeTruthy();
  });

  it('límite: la sección de la dirección se conserva al abrir y una desconocida cae en el resumen', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Usuarios', selected: true })).toBeTruthy();
  });

  it('límite: una sección inventada en la dirección muestra el resumen', async () => {
    simular();
    mostrar('/panel/admin?seccion=inventada');
    expect(await screen.findByText('Personal activo')).toBeTruthy();
  });

  it('error: avisa en las tarjetas cuando la tasa no es la de hoy y los datos de pago son de prueba', async () => {
    simular({ tasaVieja: true, pagoDePrueba: true });
    mostrar();
    expect(await screen.findByText(/NO es la de hoy/)).toBeTruthy();
    expect(screen.getByText('De prueba')).toBeTruthy();
    expect(screen.getByText(/Cárgalos antes de abrir/)).toBeTruthy();
  });
});

describe('Administración: personal (RF-171 a RF-173)', () => {
  it('caso feliz: escribir en el buscador reduce la lista sin recargar', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    fireEvent.change(screen.getByLabelText('Buscar por nombre o correo'), { target: { value: 'jose' } });
    expect(screen.getByText('José Núñez')).toBeTruthy();
    expect(screen.queryByText('Ana Pérez')).toBeNull();
    expect(screen.getByText('Mostrando 1 de 5.')).toBeTruthy();
    expect(llamadas.filter((l) => l.url === '/api/admin/usuarios')).toHaveLength(1);
  });

  it('límite: sin coincidencias ofrece quitar los filtros y los devuelve todos', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    fireEvent.change(screen.getByLabelText('Buscar por nombre o correo'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nadie coincide con ese filtro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('María Gómez')).toBeTruthy();
  });

  it('caso feliz: cada fila marca inactivos y pendientes de primer ingreso, y a uno mismo como «Tú»', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    expect(screen.getAllByText('Pendiente de primer ingreso')).toHaveLength(2);
    expect(screen.getByText('Inactivo')).toBeTruthy();
    expect(screen.getByText('Tú')).toBeTruthy();
  });

  it('caso feliz: «Nuevo usuario» abre un cuadro, y Esc lo cierra sin crear nada', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
    const cuadro = await screen.findByRole('dialog');
    expect(within(cuadro).getByLabelText('Nombre y apellido')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('error: el formulario con datos vacíos muestra los fallos y no llama al servidor', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/ }));
    const cuadro = await screen.findByRole('dialog');
    fireEvent.click(within(cuadro).getByRole('button', { name: 'Crear usuario' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('caso feliz: desactivar pregunta primero y solo entonces llama al servidor', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    const fila = screen.getByText('Ana Pérez').closest('li')!;
    fireEvent.click(within(fila).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')).toEqual({ url: '/api/admin/usuarios/u-ana', metodo: 'PATCH', cuerpo: { activo: false } }));
  });

  it('límite: elegir «Mejor no» al desactivar no cambia nada', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('Ana Pérez');
    const fila = screen.getByText('Ana Pérez').closest('li')!;
    fireEvent.click(within(fila).getByRole('button', { name: 'Desactivar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mejor no' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
  });

  it('límite: activar a alguien inactivo no pide confirmación', async () => {
    simular();
    mostrar('/panel/admin?seccion=usuarios');
    await screen.findByText('María Gómez');
    const fila = screen.getByText('María Gómez').closest('li')!;
    fireEvent.click(within(fila).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ activo: true }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('error: si el servidor falla al cargar el personal lo dice y ofrece reintentar', async () => {
    simular({ falla: true });
    mostrar('/panel/admin?seccion=usuarios');
    expect(await screen.findByText('Se cayó la conexión con el servidor.')).toBeTruthy();
  });
});
