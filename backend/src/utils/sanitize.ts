import { z } from 'zod';

/** Normaliza y elimina caracteres de control de cualquier entrada de texto. */
export function cleanText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto saneado con longitud controlada. */
export function texto(min: number, max: number) {
  return z
    .string({ error: 'Este campo es obligatorio.' })
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, `Debe tener al menos ${min} caracteres.`)
        .max(max, `No puede superar ${max} caracteres.`),
    );
}

/** Correo electrónico normalizado a minúsculas. */
export const emailSchema = z
  .string({ error: 'El correo es obligatorio.' })
  .trim()
  .toLowerCase()
  .email('Ingresa un correo válido.')
  .max(160, 'El correo es demasiado largo.');

/** Teléfono en formato internacional o colombiano. Se guarda solo con dígitos y prefijo. */
export const telefonoSchema = z
  .string({ error: 'El teléfono es obligatorio.' })
  .trim()
  .min(7, 'Ingresa un teléfono válido.')
  .max(20, 'Ingresa un teléfono válido.')
  .refine((value) => /^\+?[0-9\s()-]{7,20}$/.test(value), 'El teléfono contiene caracteres inválidos.')
  .transform((value) => value.replace(/[\s()-]/g, ''));

export const passwordSchema = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña es demasiado larga.')
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: 'La contraseña debe incluir al menos una letra y un número.',
  });

export const guiaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^VEX-\d{4}-\d{5}$/, 'La guía debe tener el formato VEX-2026-00001.');
