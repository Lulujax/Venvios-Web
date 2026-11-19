export function validarNombre(valor: string): string | null {
  const limpio = valor.trim();
  if (limpio.length < 3 || !limpio.includes(' ')) return 'Escribe tu nombre y apellido.';
  return null;
}

export function validarCedula(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 5 || digitos.length > 10) return 'La cédula debe tener entre 5 y 10 dígitos.';
  return null;
}

export function validarTelefono(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return 'Escribe el teléfono con código de país, por ejemplo 584141234567.';
  return null;
}

export function validarContrasena(valor: string): string | null {
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  return null;
}

export function validarMonto(valor: string): string | null {
  const numero = Number(valor.replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return 'Escribe un monto mayor que cero.';
  return null;
}

export function validarReferencia(valor: string): string | null {
  return valor.trim().length < 4 ? 'Escribe el número de referencia del pago.' : null;
}

export function validarTracking(valor: string): string | null {
  const limpio = valor.replace(/[^A-Za-z0-9]/g, '');
  return limpio.length < 4 ? 'El tracking es muy corto.' : null;
}
