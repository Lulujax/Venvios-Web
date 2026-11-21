import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeguimientoPaquete } from '../src/components/envio/SeguimientoPaquete';
import type { PaqueteVista } from '../src/lib/tipos';

function paquete(seguimiento: PaqueteVista['seguimiento']): PaqueteVista {
  return { id: 'p1', tracking: 'SHN26110040', recibido: true, pesoKg: null, valorDeclaradoCentavos: 1000, seguimiento, tieneFoto: false, fotoRuta: null, avisado: false, recibidoEn: null };
}

describe('Seguimiento del paquete', () => {
  it('caso feliz: muestra cada paso con su fecha, en orden', () => {
    render(
      <SeguimientoPaquete
        paquete={paquete([
          { tipo: 'PREALERTADO', etiqueta: 'Prealertado', fecha: '2026-11-17T10:00:00Z' },
          { tipo: 'EN_OFICINA', etiqueta: 'En oficina', fecha: '2026-11-18T15:30:00Z' },
          { tipo: 'CONSOLIDANDO', etiqueta: 'Consolidando', fecha: '2026-11-19T09:00:00Z' },
        ])}
      />,
    );
    const lista = screen.getByRole('list', { name: /seguimiento del paquete shn26110040/i });
    const pasos = within(lista).getAllByRole('listitem');
    expect(pasos).toHaveLength(3);
    expect(pasos[0]!.textContent).toContain('Prealertado');
    expect(pasos[2]!.textContent).toContain('Consolidando');
  });

  it('límite: un paquete sin pasos no dibuja nada', () => {
    const { container } = render(<SeguimientoPaquete paquete={paquete([])} />);
    expect(container.innerHTML).toBe('');
  });

  it('error: una fecha inválida se muestra con guion en vez de romper', () => {
    render(<SeguimientoPaquete paquete={paquete([{ tipo: 'EN_RUTA', etiqueta: 'En ruta', fecha: 'no-es-fecha' }])} />);
    expect(screen.getByText('En ruta')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('Foto con cámara o desde el teléfono', () => {
  it('caso feliz: con cámara ofrece «Tomar foto» y «Subir foto»', async () => {
    const { FotoInput } = await import('../src/components/FotoInput');
    render(<FotoInput etiqueta="Foto de la guía" archivo={null} onChange={() => undefined} usarCamara />);
    expect(screen.getByRole('button', { name: /tomar foto/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /subir foto/i })).toBeTruthy();
    expect(document.querySelectorAll('input[type="file"][capture]')).toHaveLength(1);
    expect(document.querySelectorAll('input[type="file"]:not([capture])')).toHaveLength(1);
  });

  it('límite: sin cámara solo deja elegir una imagen', async () => {
    const { FotoInput } = await import('../src/components/FotoInput');
    render(<FotoInput etiqueta="Captura del pago" archivo={null} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: /elegir imagen/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /tomar foto/i })).toBeNull();
  });
});

describe('Paquetes de un consolidado', () => {
  it('error corregido: un paquete de un envío entregado ya no dice «En bodega»', async () => {
    const { PaquetesCliente } = await import('../src/components/envio/PaquetesLista');
    render(<PaquetesCliente paquetes={[paquete([{ tipo: 'ENTREGADO', etiqueta: 'Entregado', fecha: '2026-11-20T10:00:00Z' }])]} etiquetaEnvio="Entregado" />);
    expect(screen.queryByText('En bodega')).toBeNull();
    expect(screen.getByText('Entregado')).toBeTruthy();
    expect(screen.queryByRole('list', { name: /seguimiento del paquete/i })).toBeNull();
  });
});
