import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { camposFaltantesDeEntrega, EntregaPersonal } from '../src/components/envio/EntregaPersonal';
import { ProveedorAvisos } from '../src/components/ui';
import type { Envio } from '../src/lib/tipos';

const COMPLETA = { nombre: 'Rosa Prueba Silva', cedula: '20000103', telefono: '573001110003', agencia: 'MRW Barquisimeto', ciudad: 'Barquisimeto', estado: 'Lara' };
const VACIA = { nombre: null, cedula: null, telefono: null, agencia: null, ciudad: null, estado: null };

function envio(entrega: Envio['entrega'], estado: Envio['estado'] = 'PAGADO'): Envio {
  return { id: 'e1', numero: 123, tipo: 'CONSOLIDADO', estado, transportista: 'MRW', cliente: { id: 'c1', nombre: 'Rosa Prueba Silva' }, entrega } as unknown as Envio;
}

interface Llamada {
  url: string;
  metodo: string;
}

let llamadas: Llamada[] = [];

function simular(respuesta: { estado: number; cuerpo: unknown }) {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, pedido?: RequestInit) => {
      llamadas.push({ url, metodo: pedido?.method ?? 'GET' });
      return new Response(JSON.stringify(respuesta.cuerpo), { status: respuesta.estado });
    }),
  );
}

function mostrar(entrega: Envio['entrega'], opciones: { bloqueado?: boolean; alCambiar?: (e: Envio) => void; estado?: Envio['estado'] } = {}) {
  return render(
    <ProveedorAvisos>
      <EntregaPersonal envio={envio(entrega, opciones.estado)} alCambiar={opciones.alCambiar ?? (() => undefined)} bloqueado={opciones.bloqueado ?? false} />
    </ProveedorAvisos>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('datos de entrega vistos por el personal (RF-162 a RF-167)', () => {
  it('caso feliz: con los datos completos muestra un resumen de solo lectura y no un formulario', () => {
    mostrar(COMPLETA);
    expect(screen.getByText('MRW Barquisimeto')).toBeTruthy();
    expect(screen.getByText('Lara')).toBeTruthy();
    expect(screen.getByText(/vienen del perfil de Rosa Prueba Silva/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Corregir datos' })).toBeTruthy();
  });

  it('caso feliz: «Corregir datos» abre el formulario con los datos actuales y «Cancelar» vuelve al resumen', () => {
    mostrar(COMPLETA);
    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    expect((screen.getByLabelText('Agencia donde retira') as HTMLInputElement).value).toBe('MRW Barquisimeto');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Corregir datos' })).toBeTruthy();
  });

  it('límite: si el envío ya salió muestra el resumen sin el botón de corregir', () => {
    mostrar(COMPLETA, { bloqueado: true, estado: 'DESPACHADO' });
    expect(screen.getByText('MRW Barquisimeto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Corregir datos' })).toBeNull();
  });

  it('límite: si faltan datos muestra el formulario directo, dice cuáles faltan y ofrece usar el perfil', () => {
    mostrar({ ...COMPLETA, agencia: null, ciudad: '' });
    expect(screen.getByText(/Faltan datos de entrega: agencia, ciudad/)).toBeTruthy();
    expect(screen.getByLabelText('Agencia donde retira')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Usar los datos del perfil de Rosa Prueba Silva' })).toBeTruthy();
  });

  it('caso feliz: «Usar los datos del perfil» los copia con un toque y avisa al panel', async () => {
    const copiado = { ...envio(COMPLETA) };
    simular({ estado: 200, cuerpo: { envio: copiado } });
    const alCambiar = vi.fn();
    mostrar(VACIA, { alCambiar });
    fireEvent.click(screen.getByRole('button', { name: 'Usar los datos del perfil de Rosa Prueba Silva' }));
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(copiado));
    expect(llamadas).toEqual([{ url: '/api/envios/e1/entrega/perfil', metodo: 'POST' }]);
  });

  it('error: si el perfil no tiene los datos muestra el mensaje del servidor y deja el formulario para escribirlos', async () => {
    simular({ estado: 400, cuerpo: { error: { mensaje: 'El perfil no tiene los datos de entrega de esta transportista.', codigo: 'PERFIL_INCOMPLETO' } } });
    const alCambiar = vi.fn();
    mostrar(VACIA, { alCambiar });
    fireEvent.click(screen.getByRole('button', { name: 'Usar los datos del perfil de Rosa Prueba Silva' }));
    expect(await screen.findByText('El perfil no tiene los datos de entrega de esta transportista.')).toBeTruthy();
    expect(alCambiar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Agencia donde retira')).toBeTruthy();
  });
});

describe('camposFaltantesDeEntrega', () => {
  it('caso feliz y límites: completa no falta nada; vacía faltan los seis; el texto en blanco cuenta como faltante', () => {
    expect(camposFaltantesDeEntrega(COMPLETA)).toEqual([]);
    expect(camposFaltantesDeEntrega(VACIA)).toHaveLength(6);
    expect(camposFaltantesDeEntrega({ ...COMPLETA, telefono: '   ' })).toEqual(['teléfono']);
  });
});
