import { describe, expect, it } from 'vitest';
import { armarInformeBodega, type ItemInformeBodega } from '../src/domain/informeBodega';

function item(parcial: Partial<ItemInformeBodega>): ItemInformeBodega {
  return {
    tracking: 'ABC123',
    pesoKg: 2,
    recibidoEn: '2026-11-20T10:00:00.000Z',
    diasEnBodega: 3,
    avisado: true,
    tieneFoto: true,
    tipoEnvio: 'ALERTA',
    sinDueno: false,
    enCamino: false,
    cliente: { id: 'c1', nombre: 'Ana Prueba', codigo: 'VENV-000001' },
    ...parcial,
  };
}

describe('Informe de bodega agrupado por cliente (RF-2, RF-3, RF-4, RF-7)', () => {
  it('caso feliz: agrupa por cliente, suma subtotales y el resumen general', () => {
    const informe = armarInformeBodega([
      item({ pesoKg: 2 }),
      item({ tracking: 'ABC124', pesoKg: 3, avisado: false }),
      item({ cliente: { id: 'c2', nombre: 'Beto Prueba', codigo: 'VENV-000002' }, pesoKg: 1.5 }),
    ]);

    expect(informe.clientes).toHaveLength(2);
    const ana = informe.clientes.find((c) => c.cliente.id === 'c1')!;
    expect(ana.totalPaquetes).toBe(2);
    expect(ana.pesoTotalKg).toBe(5);
    expect(informe.resumen.totalPaquetes).toBe(3);
    expect(informe.resumen.pesoTotalKg).toBe(6.5);
    expect(informe.resumen.sinAvisar).toBe(1);
  });

  it('límite: una lista vacía da un informe con el resumen en cero y sin clientes', () => {
    const informe = armarInformeBodega([]);
    expect(informe.clientes).toHaveLength(0);
    expect(informe.resumen).toEqual({ totalPaquetes: 0, pesoTotalKg: 0, sinDueno: 0, sinAvisar: 0, totalEnCamino: 0 });
  });

  it('límite: un paquete sin peso (null) no rompe la suma y cuenta como sin dueño', () => {
    const informe = armarInformeBodega([item({ pesoKg: null, sinDueno: true, avisado: false })]);
    expect(informe.clientes[0]!.pesoTotalKg).toBe(0);
    expect(informe.resumen.sinDueno).toBe(1);
    expect(informe.resumen.sinAvisar).toBe(0);
  });

  it('separa los paquetes "en camino" del resumen de recibidos y los suma aparte', () => {
    const informe = armarInformeBodega([item({}), item({ tracking: 'EN-CAMINO', enCamino: true, pesoKg: null, recibidoEn: null, diasEnBodega: null })]);
    expect(informe.resumen.totalPaquetes).toBe(1);
    expect(informe.resumen.totalEnCamino).toBe(1);
    expect(informe.clientes[0]!.totalEnCamino).toBe(1);
    expect(informe.clientes[0]!.totalPaquetes).toBe(1);
  });
});
