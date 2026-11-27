import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';

let entorno: Entorno;

beforeEach(async () => {
  entorno = await crearEntorno();
});

describe('prealerta de origen en paquetes (T-1, T-2, T-3)', () => {
  it('T-1: la migración crea columna, índice, clave foránea SET NULL y rellena solo prealertas reales', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma', 'migrations', '20261127000000_paquete_prealerta_origen', 'migration.sql'),
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN "prealertaOrigenId" TEXT');
    expect(sql).toContain('CREATE INDEX "Paquete_prealertaOrigenId_idx"');
    expect(sql).toContain('ON DELETE SET NULL');
    expect(sql).toContain("'Sin prealerta'");
    expect(sql).toContain("'Devuelto a bodega'");
    expect(sql).toContain("'CANCELADO'");
  });

  it('T-2: crear prealerta, agregar paquetes, consolidar y desarmar conservan prealertaOrigenId y paquetesPorOrigen devuelve su etapa actual', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);

    const creada = await cliente.agente.post('/api/envios').send({
      trackings: ['ORIG-001', 'ORIG-002', 'ORIG-003'],
      tienda: 'Shein',
      valoresUsd: [10, 10, 10],
    });
    expect(creada.status).toBe(201);
    const prealertaId = creada.body.envio.id as string;

    const extras = await entorno.contexto.repos.envios.agregarPaquetes(prealertaId, [
      { trackingTexto: 'ORIG-004', trackingNormalizado: 'ORIG004', valorDeclaradoCentavos: 1000 },
    ]);
    expect(extras[0]!.prealertaOrigenId).toBe(prealertaId);

    const guardada = await entorno.contexto.repos.envios.porId(prealertaId);
    expect(guardada!.paquetes.every((p) => p.prealertaOrigenId === prealertaId)).toBe(true);

    await operador.agente.post('/api/staff/escaneo').send({ texto: 'ORIG-001' });
    await operador.agente.post('/api/staff/escaneo').send({ texto: 'ORIG-002' });

    const p1 = guardada!.paquetes.find((p) => p.trackingTexto === 'ORIG-001')!.id;
    const p2 = guardada!.paquetes.find((p) => p.trackingTexto === 'ORIG-002')!.id;
    const consolidado = await cliente.agente.post('/api/envios/consolidar').send({
      paqueteIds: [p1, p2],
      modalidad: 'M1',
      transportista: 'MRW',
    });
    expect(consolidado.status).toBe(201);
    const consolidadoId = consolidado.body.envio.id as string;

    const porOrigen = await entorno.contexto.repos.envios.paquetesPorOrigen([prealertaId]);
    expect(porOrigen).toHaveLength(4);
    expect(porOrigen.filter((x) => x.envioTipo === 'CONSOLIDADO')).toHaveLength(2);
    expect(porOrigen.filter((x) => x.envioTipo === 'ALERTA' && x.paquete.estado === 'ESPERADO')).toHaveLength(2);

    const desarmado = await operador.agente.post(`/api/envios/${consolidadoId}/deshacer`).send({ motivo: 'Cliente cambia de envío' });
    expect(desarmado.status).toBe(200);
    const trasDesarmar = await entorno.contexto.repos.envios.paquetesPorOrigen([prealertaId]);
    expect(trasDesarmar).toHaveLength(4);
    expect(trasDesarmar.every((x) => x.paquete.prealertaOrigenId === prealertaId)).toBe(true);
  });

  it('T-3: paquete sin dueño reclamado por prealerta guarda esa prealerta como origen; asignado a mano queda sin prealerta', async () => {
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    const cliente = await registrarCliente(entorno);

    const sinReclamo = await operador.agente.post('/api/staff/sin-prealerta').send({ texto: 'SIN-PRE-01' });
    const sinAsignarManual = await operador.agente.post('/api/staff/sin-prealerta').send({ texto: 'SIN-PRE-02' });
    const idReclamable = sinReclamo.body.envio.paquetes[0].id as string;
    const idManual = sinAsignarManual.body.envio.paquetes[0].id as string;

    const antesReclamo = await entorno.contexto.repos.envios.porPaqueteId(idReclamable);
    expect(antesReclamo!.paquetes[0]!.prealertaOrigenId).toBeNull();

    const reclamo = await cliente.agente.post('/api/envios').send({
      trackings: ['SIN-PRE-01', 'NUEVO-01'],
      tienda: 'Amazon',
      valoresUsd: [20, 30],
    });
    expect(reclamo.status).toBe(201);
    const prealertaId = reclamo.body.envio.id as string;

    const envioReclamado = await entorno.contexto.repos.envios.porId(prealertaId);
    const pkgReclamado = envioReclamado!.paquetes.find((p) => p.id === idReclamable)!;
    expect(pkgReclamado.prealertaOrigenId).toBe(prealertaId);

    const asignado = await operador.agente.post(`/api/staff/paquetes/${idManual}/asignar`).send({
      clienteId: cliente.usuario.id,
      motivo: 'Tiene nombre en la caja',
    });
    expect(asignado.status).toBe(200);
    const envioManual = await entorno.contexto.repos.envios.porPaqueteId(idManual);
    expect(envioManual!.paquetes[0]!.prealertaOrigenId).toBeNull();
  });
});
