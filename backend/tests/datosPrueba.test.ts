import { afterEach, describe, expect, it } from 'vitest';
import { ESTADOS_ENVIO } from '../src/domain/estados';
import { crearEntorno } from './ayudas';
import { cargarDatosDePrueba, leerFixtureDatosPrueba, validarFixture, type FixtureDatosPrueba } from '../src/services/DatosPrueba';

const entornoOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...entornoOriginal };
});

function fixtureMinimo(): Record<string, unknown> {
  return {
    clientes: [{ clave: 'ana', nombre: 'Ana Prueba', cedula: '20000001', email: 'ana@ejemplo.com', telefono: '573001110001' }],
    secciones: [
      {
        estado: 'PREALERTADO',
        envios: [
          {
            tipo: 'ALERTA',
            cliente: 'ana',
            modalidad: 'M1',
            transportista: 'MRW',
            tienda: 'Shein',
            valorUsd: 10,
            paquetes: [{ tracking: 'SHN00000001', estado: 'ESPERADO', pesoKg: null }],
          },
        ],
      },
    ],
  };
}

function conEnvios(envios: unknown[]): Record<string, unknown> {
  const fixture = fixtureMinimo();
  (fixture.secciones as Array<{ envios: unknown[] }>)[0]!.envios = envios;
  return fixture;
}

function envioDe(paquetes: unknown[], cliente = 'ana'): Record<string, unknown> {
  return { tipo: 'ALERTA', cliente, modalidad: 'M1', transportista: 'MRW', tienda: 'Shein', valorUsd: 10, paquetes };
}

describe('datos de prueba en memoria', () => {
  it('caso feliz: el archivo real trae al menos 100 paquetes repartidos en las 11 secciones de estado', async () => {
    const entorno = await crearEntorno();
    const fixture = leerFixtureDatosPrueba();
    const resumen = await cargarDatosDePrueba(entorno.contexto, fixture);
    const envios = await entorno.contexto.repos.envios.listar({ limite: 1000 });
    const paquetes = envios.reduce((total, envio) => total + envio.paquetes.length, 0);
    expect(resumen.paquetes).toBeGreaterThanOrEqual(100);
    expect(paquetes).toBe(resumen.paquetes);
    expect(new Set(envios.map((envio) => envio.estado))).toEqual(new Set(ESTADOS_ENVIO));
  });

  it('caso feliz: un paquete recibido queda con su peso en centésimas y su estado', async () => {
    const entorno = await crearEntorno();
    await cargarDatosDePrueba(entorno.contexto, leerFixtureDatosPrueba());
    const envio = (await entorno.contexto.repos.envios.porTracking('SHN26110020'))!;
    const paquete = envio.paquetes.find((candidato) => candidato.trackingNormalizado === 'SHN26110020')!;
    expect(envio.estado).toBe('RECIBIDO_COMPLETO');
    expect(paquete.estado).toBe('RECIBIDO');
    expect(paquete.pesoCentesimas).toBe(50);
  });

  it('caso feliz: cada cliente de prueba carga con sus datos de entrega de MRW y Zoom ya llenos', async () => {
    const entorno = await crearEntorno();
    const fixture = leerFixtureDatosPrueba();
    await cargarDatosDePrueba(entorno.contexto, fixture);
    const clientes = await entorno.contexto.repos.usuarios.listar(['CLIENTE']);
    expect(clientes).toHaveLength(fixture.clientes.length);
    for (const cliente of clientes) {
      const perfil = await entorno.contexto.perfil.obtener(cliente.id);
      expect(perfil.entrega.completo).toEqual({ MRW: true, ZOOM: true });
    }
  });

  it('límite: un cliente de prueba sin datos de entrega queda con el perfil vacío', async () => {
    const entorno = await crearEntorno();
    await cargarDatosDePrueba(entorno.contexto, validarFixture(fixtureMinimo()));
    const [cliente] = await entorno.contexto.repos.usuarios.listar(['CLIENTE']);
    const perfil = await entorno.contexto.perfil.obtener(cliente!.id);
    expect(perfil.entrega.completo).toEqual({ MRW: false, ZOOM: false });
  });

  it('límite: una sección sin envíos no crea envíos, pero sí los clientes', async () => {
    const entorno = await crearEntorno();
    const fixture = validarFixture(conEnvios([]));
    const resumen = await cargarDatosDePrueba(entorno.contexto, fixture);
    expect(resumen).toEqual({ clientes: 1, envios: 0, paquetes: 0 });
  });

  it('error: un cliente que no existe en la lista se rechaza al validar', () => {
    const fixture = conEnvios([envioDe([{ tracking: 'SHN00000002', estado: 'ESPERADO', pesoKg: null }], 'fantasma')]);
    expect(() => validarFixture(fixture)).toThrow(/Cliente desconocido: fantasma/);
  });

  it('error: el mismo tracking repetido dentro del archivo se rechaza', () => {
    const fixture = conEnvios([
      envioDe([{ tracking: 'SHN00000003', estado: 'ESPERADO', pesoKg: null }]),
      envioDe([{ tracking: 'shn-0000-0003', estado: 'ESPERADO', pesoKg: null }]),
    ]);
    expect(() => validarFixture(fixture)).toThrow(/Tracking repetido/);
  });

  it('error: un paquete recibido sin peso se rechaza', () => {
    const fixture = conEnvios([envioDe([{ tracking: 'SHN00000004', estado: 'RECIBIDO', pesoKg: null }])]);
    expect(() => validarFixture(fixture)).toThrow(/necesita peso/);
  });

  it('error: un paquete esperado con peso se rechaza', () => {
    const fixture = conEnvios([envioDe([{ tracking: 'SHN00000005', estado: 'ESPERADO', pesoKg: 2 }])]);
    expect(() => validarFixture(fixture)).toThrow(/no lleva peso/);
  });

  it('error: un archivo que no existe muestra un mensaje claro', () => {
    expect(() => leerFixtureDatosPrueba('ruta/que/no/existe.json')).toThrow('No se encontró el archivo de datos de prueba.');
  });

  it('error: con DATABASE_URL definida no carga nada', async () => {
    const entorno = await crearEntorno();
    process.env.DATABASE_URL = 'postgresql://no-usar';
    const fixture: FixtureDatosPrueba = validarFixture(fixtureMinimo());
    await expect(cargarDatosDePrueba(entorno.contexto, fixture)).rejects.toThrow(/nunca con base de datos/);
    expect(await entorno.contexto.repos.usuarios.listar(['CLIENTE'])).toHaveLength(0);
  });

  it('error: en modo producción no carga nada', async () => {
    const entorno = await crearEntorno();
    delete process.env.DATABASE_URL;
    const fixture = validarFixture(fixtureMinimo());
    await expect(cargarDatosDePrueba({ ...entorno.contexto, produccion: true }, fixture)).rejects.toThrow(/nunca con base de datos ni en producción/);
    expect(await entorno.contexto.repos.envios.listar({ limite: 10 })).toHaveLength(0);
  });
});
