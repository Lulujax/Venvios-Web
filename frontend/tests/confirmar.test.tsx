import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProveedorConfirmar, useConfirmar, type OpcionesConfirmar } from '../src/components/Confirmar';

const OPCIONES: OpcionesConfirmar = { titulo: '¿Eliminar la alerta?', pregunta: 'Se quitará la alerta del tracking SHN26110011.', accion: 'Eliminar alerta', peligro: true };

let resultado: boolean | 'pendiente' = 'pendiente';

function Disparador({ opciones = OPCIONES }: { opciones?: OpcionesConfirmar }) {
  const pedir = useConfirmar();
  return (
    <button
      type="button"
      onClick={() => {
        resultado = 'pendiente';
        void pedir(opciones).then((respuesta) => {
          resultado = respuesta;
        });
      }}
    >
      Abrir aviso
    </button>
  );
}

function mostrar(opciones?: OpcionesConfirmar) {
  return render(
    <ProveedorConfirmar>
      <Disparador opciones={opciones} />
    </ProveedorConfirmar>,
  );
}

async function abrir() {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir aviso' }));
  return screen.findByRole('alertdialog');
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = '';
});

describe('aviso de confirmación con diseño de la marca (RF-133 a RF-136)', () => {
  it('caso feliz: muestra título, pregunta y los dos botones, y «Eliminar alerta» confirma', async () => {
    mostrar();
    const aviso = await abrir();
    expect(aviso.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '¿Eliminar la alerta?' })).toBeTruthy();
    expect(screen.getByText('Se quitará la alerta del tracking SHN26110011.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eliminar alerta' }).className).toContain('btn-peligro');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar alerta' }));
    await waitFor(() => expect(resultado).toBe(true));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('límite: «Mejor no», la X, la tecla Esc y tocar el fondo cancelan sin hacer la acción', async () => {
    const formas: Array<(aviso: HTMLElement) => void> = [
      () => fireEvent.click(screen.getByRole('button', { name: 'Mejor no' })),
      () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' })),
      () => fireEvent.keyDown(document, { key: 'Escape' }),
      (aviso) => fireEvent.click(aviso.parentElement as HTMLElement),
    ];
    for (const cerrar of formas) {
      resultado = 'pendiente';
      const { unmount } = mostrar();
      const aviso = await abrir();
      act(() => cerrar(aviso));
      await waitFor(() => expect(resultado).toBe(false));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      unmount();
    }
  });

  it('límite: tocar dentro del aviso no lo cierra', async () => {
    mostrar();
    const aviso = await abrir();
    fireEvent.click(aviso);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(resultado).toBe('pendiente');
  });

  it('límite: al cerrar devuelve el foco al botón que lo abrió y desbloquea el desplazamiento', async () => {
    mostrar();
    const disparador = screen.getByRole('button', { name: 'Abrir aviso' });
    disparador.focus();
    await abrir();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(disparador));
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('error: usar el aviso sin el proveedor falla con un mensaje claro', async () => {
    const Suelto = () => {
      const pedir = useConfirmar();
      void pedir(OPCIONES).catch((falla: Error) => {
        resultado = falla.message.includes('ConfirmarProvider') ? false : true;
      });
      return null;
    };
    render(<Suelto />);
    await waitFor(() => expect(resultado).toBe(false));
  });
});

describe('los avisos del navegador ya no se usan (RF-137)', () => {
  it('ninguna de las cinco pantallas llama a window.confirm', () => {
    const archivos = [
      'src/components/envio/Consolidado.tsx',
      'src/components/envio/DespachoForm.tsx',
      'src/pages/DetalleEnvio.tsx',
      'src/pages/cliente/MisEnvios.tsx',
    ];
    for (const archivo of archivos) {
      const texto = readFileSync(path.resolve(process.cwd(), archivo), 'utf8');
      expect(texto, archivo).not.toContain('window.confirm');
    }
  });
});
