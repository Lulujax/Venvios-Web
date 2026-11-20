import { AppError } from '../utils/errors';

export function limpiarTexto(valor: unknown, maximo = 200): string {
  if (typeof valor !== 'string') return '';
  return valor.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maximo);
}

export function validarCedula(cedula: string): string {
  const limpia = limpiarTexto(cedula, 20).replace(/[^0-9]/g, '');
  if (limpia.length < 5 || limpia.length > 10) {
    throw AppError.badRequest('La cédula debe tener entre 5 y 10 dígitos.');
  }
  return limpia;
}

export function validarTelefono(telefono: string): string {
  const soloDigitos = limpiarTexto(telefono, 25).replace(/[^0-9]/g, '');
  if (soloDigitos.length < 10 || soloDigitos.length > 15) {
    throw AppError.badRequest('El teléfono debe incluir el código de país, por ejemplo 573001234567.');
  }
  if (soloDigitos.length === 10 && soloDigitos.startsWith('3')) return `57${soloDigitos}`;
  return soloDigitos;
}

export function validarNombre(nombre: string): string {
  const limpio = limpiarTexto(nombre, 120);
  if (limpio.length < 3 || !limpio.includes(' ')) {
    throw AppError.badRequest('Escribe nombre y apellido.');
  }
  return limpio;
}

export function validarEmail(email: string): string {
  const limpio = limpiarTexto(email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) {
    throw AppError.badRequest('Escribe un correo válido, por ejemplo nombre@correo.com.');
  }
  return limpio;
}

export function requisitosContrasena(contrasena: string): { largo: boolean; mayuscula: boolean; especial: boolean } {
  return {
    largo: contrasena.length >= 8,
    mayuscula: /[A-ZÁÉÍÓÚÑ]/.test(contrasena),
    especial: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(contrasena),
  };
}

export function validarContrasena(contrasena: string): string {
  if (typeof contrasena !== 'string') throw AppError.badRequest('Escribe una contraseña.');
  const requisitos = requisitosContrasena(contrasena);
  if (!requisitos.largo || !requisitos.mayuscula || !requisitos.especial) {
    throw AppError.badRequest('La contraseña debe tener al menos 8 caracteres, una mayúscula y un carácter especial.');
  }
  if (contrasena.length > 100) throw AppError.badRequest('La contraseña es demasiado larga.');
  return contrasena;
}

export const PATRON_CODIGO = /^VENV-\d{6}$/;

export function normalizarCodigoCasillero(texto: string): string | null {
  const limpio = limpiarTexto(texto, 20).toUpperCase().replace(/[\s_]/g, '');
  const coincidencia = /^VENV-?(\d{6})$/.exec(limpio);
  return coincidencia ? `VENV-${coincidencia[1]}` : null;
}

export function validarValorDeclarado(valorUsd: number): number {
  if (!Number.isFinite(valorUsd) || valorUsd < 0) {
    throw AppError.badRequest('El valor declarado no puede ser negativo.');
  }
  if (valorUsd > 100000) throw AppError.badRequest('El valor declarado es demasiado alto.');
  return Math.round(valorUsd * 100);
}

export function validarPesoKg(kilos: number): number {
  if (!Number.isFinite(kilos) || kilos <= 0) throw AppError.badRequest('El peso debe ser mayor que cero.');
  if (kilos > 500) throw AppError.badRequest('El peso supera el máximo permitido.');
  return Math.round(kilos * 100) / 100;
}
