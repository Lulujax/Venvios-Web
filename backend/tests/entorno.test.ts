import { afterEach, describe, expect, it } from 'vitest';
import { variableConValor } from '../src/config/contexto';

const NOMBRE = 'VARIABLE_DE_PRUEBA_VENVIOS';

afterEach(() => {
  delete process.env[NOMBRE];
});

describe('variables de entorno', () => {
  it('caso feliz: devuelve el valor sin espacios', () => {
    process.env[NOMBRE] = '  abc123  ';
    expect(variableConValor(NOMBRE)).toBe('abc123');
  });

  it('límite: una variable vacía o con solo espacios cuenta como no definida', () => {
    process.env[NOMBRE] = '';
    expect(variableConValor(NOMBRE)).toBeUndefined();
    process.env[NOMBRE] = '   ';
    expect(variableConValor(NOMBRE)).toBeUndefined();
  });

  it('error evitado: una variable que no existe devuelve undefined sin fallar', () => {
    expect(variableConValor(NOMBRE)).toBeUndefined();
  });
});

describe('URL de la base de datos', () => {
  it('caso feliz: acepta postgresql:// y postgres://', async () => {
    const { validarUrlBaseDatos } = await import('../src/config/contexto');
    expect(validarUrlBaseDatos('postgresql://u:c@host:5432/db')).toContain('postgresql://');
    expect(validarUrlBaseDatos('postgres://u:c@host/db')).toContain('postgres://');
  });

  it('error: una dirección https:// explica que va en SUPABASE_URL', async () => {
    const { validarUrlBaseDatos } = await import('../src/config/contexto');
    expect(() => validarUrlBaseDatos('https://proyecto.supabase.co')).toThrow('SUPABASE_URL');
  });

  it('error: cualquier otro texto pide postgresql://', async () => {
    const { validarUrlBaseDatos } = await import('../src/config/contexto');
    expect(() => validarUrlBaseDatos('localhost:5432')).toThrow('postgresql://');
  });
});
