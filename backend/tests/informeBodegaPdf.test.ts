import { describe, expect, it } from 'vitest';
import { armarInformeBodega } from '../src/domain/informeBodega';
import { generarPdfInformeBodega } from '../src/pdf/informeBodegaPdf';

describe('PDF del informe de bodega (RF-1, RF-6, RF-7)', () => {
  it('caso feliz: genera un PDF válido con clientes y paquetes', async () => {
    const informe = armarInformeBodega([
      {
        tracking: 'ABC123',
        pesoKg: 2.5,
        recibidoEn: '2026-11-20T10:00:00.000Z',
        diasEnBodega: 3,
        avisado: true,
        tieneFoto: true,
        tipoEnvio: 'ALERTA',
        sinDueno: false,
        enCamino: false,
        cliente: { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' },
      },
    ]);
    const pdf = await generarPdfInformeBodega(informe, 'búsqueda "ana"');
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(500);
  });

  it('límite: un informe sin paquetes genera igual un PDF válido, sin romperse', async () => {
    const informe = armarInformeBodega([]);
    const pdf = await generarPdfInformeBodega(informe, '');
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
