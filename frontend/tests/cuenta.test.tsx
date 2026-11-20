import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoContrasena, CampoTelefono, RequisitosContrasenaLista } from '../src/components/ui';
import { construirAlertas, esCobrable, filtrarAlertas, filtrarPedidos, resumirCuenta } from '../src/lib/cuenta';
import { monedaDelMetodo } from '../src/lib/pago';
import { PAISES, componerTelefono, validarTelefonoLocal } from '../src/lib/telefono';
import type { Envio, EstadoEnvio } from '../src/lib/tipos';
import { requisitosContrasena, validarContrasena, validarEmail, validarIdentificador, validarRepeticion } from '../src/lib/validar';

function envioDe(estado: EstadoEnvio, extra: Partial<Envio> = {}): Envio {
  return {
    id: `e-${estado}`,
    estado,
    tienda: 'Shein',
    creadoEn: '2026-11-10T12:00:00Z',
    paquetes: [{ id: 'p1', tracking: 'XC-100', recibido: estado !== 'PREALERTADO' }],
    precio: { pesoCobrableKg: 2, precioPorKgCentavos: 950, fleteCentavos: 1900, seguroCentavos: 300, totalCentavos: 2200, totalBsCentavos: 200000 },
    pagadoCentavos: 0,
    tasa: { bolivaresPorUsd: 90, fecha: '2026-11-19', desactualizada: false },
    pagos: [],
    ...extra,
  } as unknown as Envio;
}

describe('contraseña', () => {
  it('caso feliz: cumple largo, mayúscula y carácter especial', () => {
    expect(validarContrasena('Clave2026!')).toBeNull();
    expect(requisitosContrasena('Clave2026!')).toEqual({ largo: true, mayuscula: true, especial: true });
  });

  it('error: falta mayúscula, carácter especial o largo', () => {
    expect(validarContrasena('clave2026!')).not.toBeNull();
    expect(validarContrasena('Clave20260')).not.toBeNull();
    expect(validarContrasena('Cl2026!')).not.toBeNull();
  });

  it('límite: exactamente 8 caracteres válidos pasa', () => {
    expect(validarContrasena('Abcdef1!')).toBeNull();
  });

  it('la repetición debe coincidir', () => {
    expect(validarRepeticion('Clave2026!', 'Clave2026!')).toBeNull();
    expect(validarRepeticion('Clave2026!', 'clave2026!')).not.toBeNull();
  });

  it('la lista de requisitos marca lo cumplido', () => {
    render(<RequisitosContrasenaLista contrasena="Hola" />);
    expect(screen.getByText(/Una letra mayúscula/).textContent).toContain('cumplido');
    expect(screen.getByText(/Mínimo 8 caracteres/).textContent).toContain('pendiente');
  });
});

describe('correo e identificador', () => {
  it('valida correos', () => {
    expect(validarEmail('ana@correo.com')).toBeNull();
    expect(validarEmail('ana@correo')).not.toBeNull();
    expect(validarEmail('')).not.toBeNull();
  });

  it('el identificador de acceso no puede estar vacío', () => {
    expect(validarIdentificador('VENV-123456')).toBeNull();
    expect(validarIdentificador(' ')).not.toBeNull();
  });
});

describe('teléfono con país', () => {
  it('Venezuela es el primer país y compone con el prefijo 58', () => {
    expect(PAISES[0]?.codigo).toBe('VE');
    expect(componerTelefono('VE', '4241234567')).toBe('584241234567');
  });

  it('quita el cero inicial y los separadores', () => {
    expect(componerTelefono('VE', '0424-123 4567')).toBe('584241234567');
  });

  it('error: número demasiado corto', () => {
    expect(validarTelefonoLocal('VE', '123')).not.toBeNull();
    expect(validarTelefonoLocal('VE', '4241234567')).toBeNull();
  });

  it('el campo muestra el ejemplo de Venezuela como guía y cambia al elegir otro país', () => {
    let pais = 'VE';
    const { rerender } = render(<CampoTelefono etiqueta="Teléfono de WhatsApp" pais={pais} numero="" alCambiarPais={(c) => { pais = c; }} alCambiarNumero={() => undefined} />);
    expect(screen.getByPlaceholderText('4241234567')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('País del teléfono'), { target: { value: 'CO' } });
    rerender(<CampoTelefono etiqueta="Teléfono de WhatsApp" pais={pais} numero="" alCambiarPais={() => undefined} alCambiarNumero={() => undefined} />);
    expect(screen.getByPlaceholderText('3001234567')).toBeTruthy();
  });
});

describe('campo de contraseña', () => {
  it('el botón muestra y oculta la contraseña', () => {
    render(<CampoContrasena etiqueta="Contraseña" defaultValue="Secreta2026!" />);
    const campo = screen.getByLabelText('Contraseña') as HTMLInputElement;
    expect(campo.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /Mostrar contraseña/ }));
    expect(campo.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: /Ocultar contraseña/ }));
    expect(campo.type).toBe('password');
  });
});

describe('método y moneda de pago', () => {
  it('Binance es en dólares; pago móvil y transferencia en bolívares', () => {
    expect(monedaDelMetodo('BINANCE')).toBe('USD');
    expect(monedaDelMetodo('PAGO_MOVIL')).toBe('BS');
    expect(monedaDelMetodo('TRANSFERENCIA')).toBe('BS');
  });

  it('error: un método desconocido falla', () => {
    expect(() => monedaDelMetodo('EFECTIVO')).toThrow();
  });
});

describe('clasificación de la cuenta del cliente', () => {
  const envios = [
    envioDe('PREALERTADO'),
    envioDe('RECIBIDO_PARCIAL', { id: 'parcial', paquetes: [{ id: 'a', tracking: 'AAA-1', recibido: true }, { id: 'b', tracking: 'BBB-2', recibido: false }] as Envio['paquetes'] }),
    envioDe('RECIBIDO_COMPLETO'),
    envioDe('POR_CONFIRMAR'),
    envioDe('PAGADO'),
    envioDe('DESPACHADO'),
    envioDe('CERRADO'),
    envioDe('CANCELADO'),
  ];

  it('Pedidos muestra pagados y pendientes de pago, sin prealertas ni cancelados', () => {
    expect(filtrarPedidos(envios, 'TODOS').map((e) => e.estado)).toEqual(['RECIBIDO_COMPLETO', 'POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO']);
    expect(filtrarPedidos(envios, 'PENDIENTES')).toHaveLength(2);
    expect(filtrarPedidos(envios, 'PAGADOS')).toHaveLength(3);
  });

  it('Alertas: Pendiente mientras no llega y Atendida cuando llegó', () => {
    const alertas = construirAlertas(envios);
    expect(alertas.find((a) => a.tracking === 'BBB-2')?.estado).toBe('PENDIENTE');
    expect(alertas.find((a) => a.tracking === 'AAA-1')?.estado).toBe('ATENDIDA');
    expect(alertas.some((a) => a.envioId === 'e-CANCELADO')).toBe(false);
  });

  it('Alertas se filtran por tracking y por estado', () => {
    const alertas = construirAlertas(envios);
    expect(filtrarAlertas(alertas, 'bbb2', 'TODOS')).toHaveLength(1);
    expect(filtrarAlertas(alertas, '', 'PENDIENTE').every((a) => a.estado === 'PENDIENTE')).toBe(true);
    expect(filtrarAlertas(alertas, 'no-existe', 'TODOS')).toHaveLength(0);
  });

  it('Finanzas solo cobra lo que llegó completo y ya tiene precio', () => {
    expect(esCobrable(envioDe('RECIBIDO_COMPLETO'))).toBe(true);
    expect(esCobrable(envioDe('RECIBIDO_COMPLETO', { precio: null }))).toBe(false);
    expect(esCobrable(envioDe('PAGADO'))).toBe(false);
  });

  it('el resumen suma el saldo por pagar y resta lo ya pagado', () => {
    const resumen = resumirCuenta([envioDe('RECIBIDO_COMPLETO', { pagadoCentavos: 500 })]);
    expect(resumen.porPagar).toBe(1);
    expect(resumen.saldoPorPagarCentavos).toBe(1700);
  });
});
