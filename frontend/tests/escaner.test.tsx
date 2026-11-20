import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Escaner,
  MENSAJE_FALLO_FOTO,
  MENSAJE_FOTO_PESADA,
  MENSAJE_NO_IMAGEN,
  MENSAJE_SIN_CODIGO,
  describirErrorCamara,
  validarFoto,
} from '../src/components/Escaner';
import type { LectorCodigos } from '../src/lib/lectorCodigos';

function lectorFalso(comportamiento: Partial<LectorCodigos> = {}): LectorCodigos {
  return {
    nombre: 'falso',
    leerCuadro: vi.fn().mockResolvedValue([]),
    leerImagen: vi.fn().mockResolvedValue([]),
    ...comportamiento,
  };
}

function elegirArchivo(archivo: File) {
  const entrada = screen.getByLabelText('Elegir foto de la etiqueta');
  fireEvent.change(entrada, { target: { files: [archivo] } });
}

function fotoPng(): File {
  return new File(['contenido'], 'etiqueta.png', { type: 'image/png' });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
});

describe('validarFoto', () => {
  it('caso feliz: una imagen normal es válida', () => {
    expect(validarFoto({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
  });

  it('límite: justo en el máximo de 15 MB es válida y un byte más no', () => {
    expect(validarFoto({ type: 'image/png', size: 15 * 1024 * 1024 })).toBeNull();
    expect(validarFoto({ type: 'image/png', size: 15 * 1024 * 1024 + 1 })).toBe(MENSAJE_FOTO_PESADA);
  });

  it('error: un archivo que no es imagen se rechaza', () => {
    expect(validarFoto({ type: 'application/pdf', size: 100 })).toBe(MENSAJE_NO_IMAGEN);
  });
});

describe('Escaner: leer una foto', () => {
  it('caso feliz: una foto con código entrega el texto leído', async () => {
    const lector = lectorFalso({ leerImagen: vi.fn().mockResolvedValue(['JTC000123456789']) });
    const onLeido = vi.fn();
    render(<Escaner onLeido={onLeido} obtenerLector={async () => lector} />);
    elegirArchivo(fotoPng());
    await waitFor(() => expect(onLeido).toHaveBeenCalledWith('JTC000123456789'));
    expect(lector.leerImagen).toHaveBeenCalledTimes(1);
  });

  it('caso feliz: se puede elegir la misma foto otra vez y se lee de nuevo', async () => {
    const lector = lectorFalso({ leerImagen: vi.fn().mockResolvedValue(['REPETIDO123']) });
    const onLeido = vi.fn();
    render(<Escaner onLeido={onLeido} obtenerLector={async () => lector} />);
    elegirArchivo(fotoPng());
    await waitFor(() => expect(onLeido).toHaveBeenCalledTimes(1));
    elegirArchivo(fotoPng());
    await waitFor(() => expect(onLeido).toHaveBeenCalledTimes(2));
  });

  it('límite: una foto sin código muestra el aviso y no entrega nada', async () => {
    const onLeido = vi.fn();
    render(<Escaner onLeido={onLeido} obtenerLector={async () => lectorFalso()} />);
    elegirArchivo(fotoPng());
    expect(await screen.findByText(MENSAJE_SIN_CODIGO)).toBeInTheDocument();
    expect(onLeido).not.toHaveBeenCalled();
  });

  it('error: un archivo que no es imagen se rechaza sin leerlo', async () => {
    const lector = lectorFalso();
    render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lector} />);
    elegirArchivo(new File(['x'], 'documento.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(MENSAJE_NO_IMAGEN)).toBeInTheDocument();
    expect(lector.leerImagen).not.toHaveBeenCalled();
  });

  it('error: una foto demasiado pesada se rechaza sin leerla', async () => {
    const lector = lectorFalso();
    render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lector} />);
    const pesada = fotoPng();
    Object.defineProperty(pesada, 'size', { value: 16 * 1024 * 1024 });
    elegirArchivo(pesada);
    expect(await screen.findByText(MENSAJE_FOTO_PESADA)).toBeInTheDocument();
    expect(lector.leerImagen).not.toHaveBeenCalled();
  });

  it('error: si el lector se cae muestra un mensaje claro', async () => {
    const lector = lectorFalso({ leerImagen: vi.fn().mockRejectedValue(new Error('wasm no cargó')) });
    render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lector} />);
    elegirArchivo(fotoPng());
    expect(await screen.findByText(MENSAJE_FALLO_FOTO)).toBeInTheDocument();
  });
});

describe('Escaner: cámara', () => {
  function prepararCamara() {
    const detener = vi.fn();
    const pista = { stop: detener, getSettings: () => ({ width: 1280, height: 720 }), getCapabilities: () => ({}) };
    const flujo = { getTracks: () => [pista], getVideoTracks: () => [pista] };
    const getUserMedia = vi.fn().mockResolvedValue(flujo);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true });
    return { detener, getUserMedia };
  }

  it('error: sin cámara disponible muestra el motivo y deja la búsqueda a mano', async () => {
    render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lectorFalso()} />);
    fireEvent.click(screen.getByRole('button', { name: /Encender cámara/ }));
    expect(await screen.findByText(describirErrorCamara(null))).toBeInTheDocument();
  });

  it('caso feliz: lee un código de la cámara y no repite el mismo en pocos segundos', async () => {
    prepararCamara();
    const lector = lectorFalso({ leerCuadro: vi.fn().mockResolvedValue(['QR1234567']) });
    const onLeido = vi.fn();
    render(<Escaner onLeido={onLeido} obtenerLector={async () => lector} />);
    fireEvent.click(screen.getByRole('button', { name: /Encender cámara/ }));
    await waitFor(() => expect(onLeido).toHaveBeenCalledWith('QR1234567'));
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 600));
    });
    expect(onLeido).toHaveBeenCalledTimes(1);
  });

  it('límite: mientras la página busca (pausado) la cámara sigue encendida y no se lee', async () => {
    const { detener, getUserMedia } = prepararCamara();
    const lector = lectorFalso({ leerCuadro: vi.fn().mockResolvedValue([]) });
    const { rerender } = render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lector} />);
    fireEvent.click(screen.getByRole('button', { name: /Encender cámara/ }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lector.leerCuadro).toHaveBeenCalled());
    rerender(<Escaner onLeido={vi.fn()} pausado obtenerLector={async () => lector} />);
    const lecturasAntes = vi.mocked(lector.leerCuadro).mock.calls.length;
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 600));
    });
    expect(vi.mocked(lector.leerCuadro).mock.calls.length).toBe(lecturasAntes);
    rerender(<Escaner onLeido={vi.fn()} obtenerLector={async () => lector} />);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(detener).not.toHaveBeenCalled();
  });

  it('caso feliz: al apagar la cámara se liberan las pistas de video', async () => {
    const { detener, getUserMedia } = prepararCamara();
    render(<Escaner onLeido={vi.fn()} obtenerLector={async () => lectorFalso()} />);
    fireEvent.click(screen.getByRole('button', { name: /Encender cámara/ }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: /Apagar cámara/ }));
    await waitFor(() => expect(detener).toHaveBeenCalled());
  });
});
