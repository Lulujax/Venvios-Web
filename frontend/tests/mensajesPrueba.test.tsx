import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorConfirmar } from '../src/components/Confirmar';
import { ProveedorAvisos } from '../src/components/ui';
import { enlacePruebaWhatsApp, renderizarEjemplo, variablesDesconocidas } from '../src/lib/plantillas';
import Administracion from '../src/pages/panel/Administracion';

vi.mock('../src/lib/auth', () => ({ useAuth: () => ({ usuario: { id: 'u-admin', rol: 'ADMIN' } }) }));

const PLANTILLAS = {
  llegada: 'Hola {nombre}, llegó tu paquete {tracking}.\n{linea_peso}\n{variable_rara}',
  cotizacion: 'Total: {linea_total}',
  pagoVerificado: 'Pago ok',
  pagoRechazado: 'Hola {nombre}, rechazamos tu pago: {motivo}',
  despacho: 'Guía {guia}',
};

function simular(whatsapp: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/admin/config/plantillas') return new Response(JSON.stringify({ valor: PLANTILLAS }), { status: 200 });
      if (url === '/api/admin/config/contacto') return new Response(JSON.stringify({ valor: { whatsapp, correo: '', direccion: '', horario: '', instagram: '', facebook: '', tiktok: '' } }), { status: 200 });
      return new Response(JSON.stringify({ error: { mensaje: 'Ruta sin preparar' } }), { status: 404 });
    }),
  );
}

function mostrar() {
  return render(
    <MemoryRouter initialEntries={['/panel/admin?seccion=mensajes']}>
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

describe('plantillas de ejemplo (RF-175)', () => {
  it('caso feliz: reemplaza las variables conocidas por datos de ejemplo', () => {
    expect(renderizarEjemplo('Hola {nombre}, tu guía es {guia}.')).toBe('Hola Rosa, tu guía es MRW-0012345.');
  });

  it('límite: una línea con solo una variable desconocida se omite y no quedan llaves', () => {
    const texto = renderizarEjemplo('Hola {nombre}\n{variable_rara}\nChao');
    expect(texto).toBe('Hola Rosa\nChao');
    expect(texto).not.toContain('{');
  });

  it('límite: detecta variables que no existen sin repetirlas', () => {
    expect(variablesDesconocidas('{nombre} {inventada} {inventada} {otra}')).toEqual(['inventada', 'otra']);
    expect(variablesDesconocidas('{nombre} {tracking}')).toEqual([]);
  });

  it('error: una plantilla que no es texto lanza un error claro', () => {
    expect(() => renderizarEjemplo(undefined as unknown as string)).toThrow('La plantilla debe ser texto.');
  });
});

describe('enlace de prueba a WhatsApp (RF-176)', () => {
  it('caso feliz: arma el enlace con solo dígitos y el texto codificado', () => {
    expect(enlacePruebaWhatsApp('+57 300 123 4567', 'Hola Rosa')).toBe('https://wa.me/573001234567?text=Hola%20Rosa');
  });

  it('error: sin número válido o sin texto no hay enlace', () => {
    expect(enlacePruebaWhatsApp('', 'Hola')).toBeNull();
    expect(enlacePruebaWhatsApp('123', 'Hola')).toBeNull();
    expect(enlacePruebaWhatsApp('573001234567', '   ')).toBeNull();
  });
});

describe('Administración · Mensajes (RF-174 a RF-176)', () => {
  it('caso feliz: muestra un mensaje a la vez con vista previa sin llaves y avisa de variables inexistentes', async () => {
    simular('573001234567');
    mostrar();
    const vista = await screen.findByTestId('vista-previa');
    expect(vista.textContent).toContain('Hola Rosa, llegó tu paquete SHN26110011.');
    expect(vista.textContent).not.toContain('{');
    expect(screen.getByText(/saldrán vacías: \{variable_rara\}/)).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('caso feliz: cambiar de mensaje cambia la vista previa', async () => {
    simular('573001234567');
    mostrar();
    await screen.findByTestId('vista-previa');
    fireEvent.click(screen.getByRole('button', { name: 'Pago rechazado' }));
    expect(screen.getByTestId('vista-previa').textContent).toBe('Hola Rosa, rechazamos tu pago: La referencia no coincide con el comprobante.');
  });

  it('caso feliz: «Enviarme una prueba» abre WhatsApp al número de la empresa con el texto sin guardar', async () => {
    simular('573001234567');
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    mostrar();
    const caja = await screen.findByRole('textbox');
    fireEvent.change(caja, { target: { value: 'Hola {nombre}, prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme una prueba' }));
    expect(abrir).toHaveBeenCalledWith('https://wa.me/573001234567?text=Hola%20Rosa%2C%20prueba', '_blank', 'noopener');
  });

  it('error: sin WhatsApp de la empresa avisa y no abre nada', async () => {
    simular('');
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    mostrar();
    await screen.findByTestId('vista-previa');
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme una prueba' }));
    expect(abrir).not.toHaveBeenCalled();
    expect(await screen.findByText(/carga el WhatsApp de la empresa/)).toBeTruthy();
  });
});
