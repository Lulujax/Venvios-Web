import { describe, expect, it } from 'vitest';
import { ajustarUrlParaServerless, esEntornoServerless, urlConexionDesdeEntorno } from '../src/config/conexionBaseDatos';

const SESION = 'postgresql://usuario.proyecto:clave@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

describe('conexión a la base en serverless', () => {
  it('caso feliz: en Vercel pasa al modo transacción con pgbouncer y una conexión por instancia', () => {
    const { url, cambios } = ajustarUrlParaServerless(SESION, true);
    const ajustada = new URL(url);
    expect(ajustada.port).toBe('6543');
    expect(ajustada.searchParams.get('pgbouncer')).toBe('true');
    expect(ajustada.searchParams.get('connection_limit')).toBe('1');
    expect(ajustada.password).toBe('clave');
    expect(cambios).toHaveLength(3);
  });

  it('límite: fuera de serverless la cadena queda igual', () => {
    expect(ajustarUrlParaServerless(SESION, false)).toEqual({ url: SESION, cambios: [] });
  });

  it('límite: respeta un connection_limit puesto a mano y no toca hosts que no son de Supabase', () => {
    const propia = 'postgresql://u:c@mi-servidor.com:5432/db?connection_limit=5';
    const { url, cambios } = ajustarUrlParaServerless(propia, true);
    expect(new URL(url).port).toBe('5432');
    expect(new URL(url).searchParams.get('connection_limit')).toBe('5');
    expect(cambios).toEqual([]);
  });

  it('límite: una cadena que ya usa el modo transacción solo recibe lo que le falta', () => {
    const { url, cambios } = ajustarUrlParaServerless(SESION.replace(':5432', ':6543') + '?pgbouncer=true', true);
    expect(new URL(url).port).toBe('6543');
    expect(cambios).toEqual(['una conexión por instancia']);
  });

  it('error: una cadena que no es de Postgres se rechaza', () => {
    expect(() => ajustarUrlParaServerless('https://proyecto.supabase.co', true)).toThrow(/postgresql/);
  });

  it('detecta Vercel y Netlify, y lee la cadena desde el entorno', () => {
    expect(esEntornoServerless({ VERCEL: '1' })).toBe(true);
    expect(esEntornoServerless({ NETLIFY: 'true' })).toBe(true);
    expect(esEntornoServerless({})).toBe(false);
    expect(urlConexionDesdeEntorno({})).toBeUndefined();
    expect(new URL(urlConexionDesdeEntorno({ DATABASE_URL: SESION, VERCEL: '1' })!).port).toBe('6543');
  });
});
