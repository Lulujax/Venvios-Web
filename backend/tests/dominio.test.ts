import { describe, expect, it } from 'vitest';
import { coincidenTrackings, normalizarTracking } from '../src/domain/tracking';
import { estadoDeAlerta, faltantesParaDespachar, validarDespacho, validarTransicion } from '../src/domain/estados';
import { esMontoExacto, validarReferenciaPago } from '../src/domain/pagos';
import {
  validarCedula,
  normalizarCodigoCasillero,
  validarContrasena,
  validarEmail,
  validarNombre,
  validarPesoKg,
  validarTelefono,
  validarValorDeclarado,
} from '../src/domain/validaciones';
import { CifradoCedula } from '../src/domain/cifrado';
import { enmascararCedula, enmascararTelefono } from '../src/utils/mask';

describe('tracking', () => {
  it('normaliza mayúsculas, espacios y ceros a la izquierda', () => {
    expect(normalizarTracking(' xc 0012-3456 ')).toBe('XC00123456');
    expect(normalizarTracking('000123456')).toBe('123456');
  });

  it('coincide aunque cambie el prefijo comúnmente agregado', () => {
    expect(coincidenTrackings('JD0123456789', '0123456789')).toBe(false);
    expect(coincidenTrackings('JD0123456789', 'JD 0123456789')).toBe(true);
    expect(coincidenTrackings('YT12345678901', '12345678901')).toBe(true);
  });

  it('error: vacío o muy corto', () => {
    expect(() => normalizarTracking('')).toThrow();
    expect(() => normalizarTracking('ab')).toThrow('corto');
  });
});

describe('estados y despacho', () => {
  it('caso feliz: un consolidado pesado pasa a pago por confirmar y vuelve a consolidar si cambian sus paquetes', () => {
    expect(() => validarTransicion('POR_CONSOLIDAR', 'POR_PAGAR')).not.toThrow();
    expect(() => validarTransicion('POR_PAGAR', 'POR_CONFIRMAR')).not.toThrow();
    expect(() => validarTransicion('POR_PAGAR', 'POR_CONSOLIDAR')).not.toThrow();
  });

  it('error: una alerta en bodega no se cobra directo y un pagado no vuelve atrás', () => {
    expect(() => validarTransicion('RECIBIDO_COMPLETO', 'POR_CONFIRMAR')).toThrow();
    expect(() => validarTransicion('PAGADO', 'POR_PAGAR')).toThrow();
    expect(() => validarTransicion('ARCHIVADO', 'PREALERTADO')).toThrow();
  });

  it('el estado de una alerta sale de sus paquetes; sin paquetes queda archivada', () => {
    expect(estadoDeAlerta([{ estado: 'ESPERADO' }, { estado: 'ESPERADO' }])).toBe('PREALERTADO');
    expect(estadoDeAlerta([{ estado: 'RECIBIDO' }, { estado: 'ESPERADO' }])).toBe('RECIBIDO_PARCIAL');
    expect(estadoDeAlerta([{ estado: 'RECIBIDO' }])).toBe('RECIBIDO_COMPLETO');
    expect(estadoDeAlerta([])).toBe('ARCHIVADO');
  });

  it('error: no se salta del recibido al despachado', () => {
    expect(() => validarTransicion('RECIBIDO_COMPLETO', 'DESPACHADO')).toThrow('No se puede pasar');
    expect(() => validarTransicion('CERRADO', 'PAGADO')).toThrow();
  });

  const entregaCompleta = {
    nombre: 'Ana Pérez',
    cedula: '12345678',
    telefono: '584141234567',
    agencia: 'MRW',
    ciudad: 'Caracas',
    estado: 'Distrito Capital',
  };

  it('caso feliz: pagado con entrega completa se puede despachar', () => {
    expect(() => validarDespacho({ estado: 'PAGADO', pagoConfirmado: true, entrega: entregaCompleta })).not.toThrow();
  });

  it('error: sin pago confirmado no se despacha', () => {
    expect(() => validarDespacho({ estado: 'POR_CONFIRMAR', pagoConfirmado: false, entrega: entregaCompleta })).toThrow('pagado');
  });

  it('límite: falta un solo dato de entrega', () => {
    const faltantes = faltantesParaDespachar({
      estado: 'PAGADO',
      pagoConfirmado: true,
      entrega: { ...entregaCompleta, ciudad: ' ' },
    });
    expect(faltantes).toEqual(['dato de entrega: ciudad']);
    expect(() => validarDespacho({ estado: 'PAGADO', pagoConfirmado: true, entrega: { ...entregaCompleta, ciudad: '' } })).toThrow('ciudad');
  });
});

describe('validaciones de datos', () => {
  it('cédula: caso feliz, límite y error', () => {
    expect(validarCedula('V-12.345.678')).toBe('12345678');
    expect(validarCedula('12345')).toBe('12345');
    expect(() => validarCedula('123')).toThrow();
    expect(() => validarCedula('abc')).toThrow();
  });

  it('teléfono: agrega 57 a celulares colombianos de 10 dígitos', () => {
    expect(validarTelefono('300 123 4567')).toBe('573001234567');
    expect(validarTelefono('+58 414 2448341')).toBe('584142448341');
    expect(() => validarTelefono('12345')).toThrow('código de país');
  });

  it('nombre, contraseña, valor y peso', () => {
    expect(validarNombre('Luis Peña')).toBe('Luis Peña');
    expect(() => validarNombre('Luis')).toThrow();
    expect(() => validarContrasena('corta')).toThrow('8 caracteres');
    expect(validarValorDeclarado(60)).toBe(6000);
    expect(validarValorDeclarado(0)).toBe(0);
    expect(() => validarValorDeclarado(-1)).toThrow();
    expect(validarPesoKg(2.345)).toBe(2.35);
    expect(() => validarPesoKg(0)).toThrow();
    expect(() => validarPesoKg(900)).toThrow('máximo');
  });
});

describe('cifrado y máscaras', () => {
  const llave = 'a'.repeat(64);

  it('cifra y descifra la cédula sin dejarla legible', () => {
    const cifrado = new CifradoCedula(llave);
    const secreto = cifrado.cifrar('12345678');
    expect(secreto).not.toContain('12345678');
    expect(cifrado.descifrar(secreto)).toBe('12345678');
  });

  it('la huella es estable para detectar duplicados', () => {
    const cifrado = new CifradoCedula(llave);
    expect(cifrado.huella('12345678')).toBe(cifrado.huella('12345678'));
    expect(cifrado.huella('12345678')).not.toBe(cifrado.huella('12345679'));
  });

  it('error: falta la llave o dato corrupto', () => {
    expect(() => new CifradoCedula(undefined)).toThrow('CEDULA_KEY');
    expect(() => new CifradoCedula(llave).descifrar('roto')).toThrow();
  });

  it('las máscaras no revelan el dato completo', () => {
    expect(enmascararCedula('12345678')).toBe('V-***678');
    expect(enmascararCedula('1')).toBe('***');
    expect(enmascararTelefono('584142448341')).not.toContain('2448');
  });
});

describe('correo, casillero y contraseña', () => {
  it('valida y normaliza el correo', () => {
    expect(validarEmail(' Ana@Correo.COM ')).toBe('ana@correo.com');
    expect(() => validarEmail('ana@correo')).toThrow();
  });

  it('normaliza el número de casillero', () => {
    expect(normalizarCodigoCasillero('venv-123456')).toBe('VENV-123456');
    expect(normalizarCodigoCasillero('VENV123456')).toBe('VENV-123456');
    expect(normalizarCodigoCasillero('VENV-12')).toBeNull();
  });

  it('exige 8 caracteres, mayúscula y carácter especial', () => {
    expect(validarContrasena('Clave2026!')).toBe('Clave2026!');
    expect(() => validarContrasena('clave2026!')).toThrow();
    expect(() => validarContrasena('Clave20260')).toThrow();
    expect(() => validarContrasena('Cl2026!')).toThrow();
  });
});

describe('pago exacto y referencia', () => {
  it('caso feliz: dólares exactos y bolívares dentro de 1 Bs de diferencia', () => {
    expect(esMontoExacto('USD', 4433, 4433, 0)).toBe(true);
    expect(esMontoExacto('BS', 3420000, 0, 3420000)).toBe(true);
    expect(esMontoExacto('BS', 3420050, 0, 3420000)).toBe(true);
  });

  it('error: pagar de más, de menos o cero no es exacto', () => {
    expect(esMontoExacto('USD', 4434, 4433, 0)).toBe(false);
    expect(esMontoExacto('USD', 4000, 4433, 0)).toBe(false);
    expect(esMontoExacto('BS', 3400000, 0, 3420000)).toBe(false);
    expect(esMontoExacto('USD', 0, 0, 0)).toBe(false);
  });

  it('la referencia son los últimos 6 dígitos', () => {
    expect(validarReferenciaPago(' 123 456 ')).toBe('123456');
    expect(() => validarReferenciaPago('12345')).toThrow('6 dígitos');
    expect(() => validarReferenciaPago('1234567')).toThrow();
    expect(() => validarReferenciaPago('ABC123')).toThrow();
  });
});
