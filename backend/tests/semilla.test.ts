import { afterEach, describe, expect, it } from 'vitest';
import { crearEntorno } from './ayudas';
import { datosAdminDesdeEntorno, sembrarCuentasDePersonal } from '../src/services/Semilla';

const entornoOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...entornoOriginal };
});

function sinCuentasDePrueba() {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.OPERADOR_PASSWORD;
}

describe('cuentas de prueba desde el entorno', () => {
  it('caso feliz: crea admin y operador desde las variables y no los duplica al repetir', async () => {
    const entorno = await crearEntorno();
    process.env.ADMIN_PASSWORD = 'AdminPrueba2026!';
    process.env.OPERADOR_PASSWORD = 'OperadorPrueba2026!';
    await sembrarCuentasDePersonal(entorno.contexto);
    await sembrarCuentasDePersonal(entorno.contexto);
    const personal = await entorno.contexto.repos.usuarios.listar(['ADMIN', 'OPERADOR']);
    expect(personal.map((u) => u.rol).sort()).toEqual(['ADMIN', 'OPERADOR']);
  });

  it('límite: sin variables no crea ninguna cuenta', async () => {
    const entorno = await crearEntorno();
    sinCuentasDePrueba();
    await sembrarCuentasDePersonal(entorno.contexto);
    expect(await entorno.contexto.repos.usuarios.listar(['ADMIN', 'OPERADOR'])).toHaveLength(0);
  });

  it('error: sin ADMIN_PASSWORD no hay datos de administrador', () => {
    sinCuentasDePrueba();
    expect(datosAdminDesdeEntorno()).toBeNull();
  });
});
