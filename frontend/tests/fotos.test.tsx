import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PagosPersonal } from '../src/components/envio/PagosPersonal';
import { ImagenPrivada } from '../src/components/ui';
import { limpiarReferencia, nombreArchivoFoto } from '../src/lib/descarga';
import type { Envio, PagoVista } from '../src/lib/tipos';

const RUTA = 'paquetes/p1.jpg';
const descargas: Array<{ nombre: string; href: string }> = [];
let urlsLiberadas: string[] = [];

function respuestaImagen(estado = 200, tipo = 'image/jpeg'): Response {
  return new Response(new Uint8Array([1, 2, 3]), { status: estado, headers: { 'Content-Type': tipo } });
}

beforeEach(() => {
  descargas.length = 0;
  urlsLiberadas = [];
  URL.createObjectURL = vi.fn(() => 'blob:foto-de-prueba');
  URL.revokeObjectURL = vi.fn((url: string) => {
    urlsLiberadas.push(url);
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    descargas.push({ nombre: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mostrar(extra: Partial<Parameters<typeof ImagenPrivada>[0]> = {}) {
  return render(<ImagenPrivada ruta={RUTA} alt="Foto del paquete SHN26110001" className="h-12 w-12" tipo="paquete" referencia="SHN26110001" {...extra} />);
}

const abrirFoto = () => fireEvent.click(screen.getByRole('button', { name: /Ampliar foto/ }));

describe('nombre del archivo descargado (RF-130)', () => {
  it('caso feliz: paquete con su tracking y guía con el nombre del envío sin tildes ni espacios', () => {
    expect(nombreArchivoFoto('paquete', 'SHN26110001', 'image/jpeg')).toBe('paquete-SHN26110001.jpg');
    expect(nombreArchivoFoto('guia', 'Consolidación 000123', 'image/png')).toBe('guia-Consolidacion-000123.png');
  });

  it('caso feliz: el comprobante lleva el nombre del envío y la referencia del pago', () => {
    expect(nombreArchivoFoto('comprobante', 'Consolidación 000123 4512987766001', 'image/jpeg')).toBe('comprobante-Consolidacion-000123-4512987766001.jpg');
    expect(nombreArchivoFoto('comprobante', 'Consolidación 000123 ', 'image/jpeg')).toBe('comprobante-Consolidacion-000123.jpg');
  });

  it('límite: una referencia muy larga se corta y no termina en guion', () => {
    const nombre = nombreArchivoFoto('paquete', `${'A'.repeat(59)} ${'B'.repeat(30)}`, 'image/webp');
    expect(nombre.endsWith('-.webp')).toBe(false);
    expect(limpiarReferencia(`${'A'.repeat(59)} ${'B'.repeat(30)}`).length).toBeLessThanOrEqual(60);
  });

  it('error: sin letras ni números, o si lo recibido no es una imagen, lanza error claro', () => {
    expect(() => nombreArchivoFoto('paquete', ' --- ', 'image/jpeg')).toThrow(/no tiene letras ni números/);
    expect(() => nombreArchivoFoto('paquete', 'SHN1', 'text/html')).toThrow(/no es una imagen/);
  });
});

describe('foto ampliada dentro de la misma página (RF-129)', () => {
  it('caso feliz: tocar la miniatura abre la ventana con la X, sin abrir otra pestaña; la X la cierra y devuelve el foco', () => {
    const abrirPestana = vi.spyOn(window, 'open').mockReturnValue(null);
    mostrar();
    expect(screen.queryByRole('dialog')).toBeNull();
    abrirFoto();
    const ventana = screen.getByRole('dialog');
    expect(within(ventana).getByRole('img').getAttribute('src')).toBe(`/api/archivos/${RUTA}`);
    expect(abrirPestana).not.toHaveBeenCalled();
    fireEvent.click(within(ventana).getByRole('button', { name: 'Cerrar foto' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Ampliar foto/ }));
  });

  it('caso feliz: la tecla Esc y tocar fuera de la foto también cierran, pero tocar la foto no', () => {
    mostrar();
    abrirFoto();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('img'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    abrirFoto();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('límite: otra tecla no cierra y al cerrar la página vuelve a poder desplazarse', () => {
    mostrar();
    abrirFoto();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('error: sin ruta, o si la imagen no carga, no se muestra nada', () => {
    const vacio = mostrar({ ruta: null });
    expect(vacio.container.querySelector('img')).toBeNull();
    vacio.unmount();
    const rota = mostrar();
    fireEvent.error(rota.container.querySelector('img')!);
    expect(rota.container.querySelector('img')).toBeNull();
  });
});

describe('comprobante de pago en la pantalla del personal (RF-130)', () => {
  function pago(extra: Partial<PagoVista> = {}): PagoVista {
    return {
      id: 'pago-1',
      estado: 'POR_CONFIRMAR',
      metodo: 'BINANCE',
      moneda: 'USD',
      montoOriginalCentavos: 4325,
      montoUsdCentavos: 4325,
      referencia: '4512987766001',
      tieneComprobante: true,
      comprobanteRuta: 'comprobantes/pago-1.jpg',
      motivoRechazo: null,
      creadoEn: '2026-11-21T10:00:00Z',
      ...extra,
    };
  }

  function mostrarPagos(pagos: PagoVista[]) {
    const envio = { id: 'e1', numero: 123, tipo: 'CONSOLIDADO', tienda: 'Shein', estado: 'POR_CONFIRMAR', precio: null, pagos } as unknown as Envio;
    return render(<PagosPersonal envio={envio} alCambiar={() => undefined} />);
  }

  it('caso feliz: el comprobante tiene «Descargar foto» y baja con el envío y la referencia en el nombre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaImagen()));
    mostrarPagos([pago()]);
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(descargas[0]?.nombre).toBe('comprobante-Consolidacion-000123-4512987766001.jpg');
  });

  it('límite: un pago sin referencia descarga solo con el nombre del envío', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaImagen()));
    mostrarPagos([pago({ referencia: null })]);
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(descargas[0]?.nombre).toBe('comprobante-Consolidacion-000123.jpg');
  });

  it('error: un pago sin comprobante no muestra foto ni botón de descargar', () => {
    mostrarPagos([pago({ tieneComprobante: false, comprobanteRuta: null })]);
    expect(screen.queryByRole('button', { name: /Descargar foto/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ampliar foto/ })).toBeNull();
  });
});

describe('descargar la foto (RF-130)', () => {
  it('caso feliz: el botón junto a la miniatura descarga con el nombre claro y libera la memoria', async () => {
    const pedir = vi.fn(async () => respuestaImagen());
    vi.stubGlobal('fetch', pedir);
    mostrar({ conBotonDescarga: true });
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(descargas[0]).toEqual({ nombre: 'paquete-SHN26110001.jpg', href: 'blob:foto-de-prueba' });
    expect(pedir).toHaveBeenCalledWith(`/api/archivos/${RUTA}`, { credentials: 'same-origin' });
    await waitFor(() => expect(urlsLiberadas).toEqual(['blob:foto-de-prueba']), { timeout: 2500 });
  });

  it('caso feliz: la foto ampliada también tiene el botón y descarga la misma foto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaImagen(200, 'image/png')));
    mostrar();
    abrirFoto();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Descargar foto/ }));
    await waitFor(() => expect(descargas).toHaveLength(1));
    expect(descargas[0]?.nombre).toBe('paquete-SHN26110001.png');
  });

  it('límite: sin botón de descarga fuera de la foto ampliada, y sin referencia no hay botón de descargar en ningún lado', () => {
    mostrar();
    expect(screen.queryByRole('button', { name: /Descargar foto/ })).toBeNull();
    abrirFoto();
    expect(screen.queryByRole('button', { name: /Descargar foto/ })).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    const sinNombre = mostrar({ referencia: undefined, tipo: undefined, conBotonDescarga: true });
    sinNombre.unmount();
    mostrar({ referencia: undefined, tipo: undefined });
    fireEvent.click(screen.getAllByRole('button', { name: /Ampliar foto/ }).at(-1)!);
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /Descargar foto/ })).toBeNull();
  });

  it('error: si el servidor falla muestra un mensaje y no descarga nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaImagen(500)));
    mostrar({ conBotonDescarga: true });
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/No pudimos descargar la foto/);
    expect(descargas).toHaveLength(0);
  });

  it('error: si se cae la conexión muestra un mensaje en español, no el error técnico del navegador', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    mostrar({ conBotonDescarga: true });
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toMatch(/Revisa tu conexión/);
    expect(aviso.textContent).not.toMatch(/Failed to fetch/);
    expect(descargas).toHaveLength(0);
  });

  it('error: si lo descargado no es una imagen lo dice y no guarda el archivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaImagen(200, 'text/html')));
    mostrar({ conBotonDescarga: true });
    fireEvent.click(screen.getByRole('button', { name: /Descargar foto/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/no es una imagen/);
    expect(descargas).toHaveLength(0);
  });
});
