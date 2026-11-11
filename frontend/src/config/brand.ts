/**
 * Datos públicos de marca. No contiene PII de clientes: los teléfonos de
 * clientes solo existen en el backend y nunca se renderizan en la interfaz.
 */
export const BRAND = {
  name: 'Venvios Express',
  slogan: 'Tu mejor opción',
  whatsappDisplay: '+57 323 796 8740',
  whatsappRaw: '573237968740',
  address: {
    line1: 'Barrio Latino, Centro',
    line2: 'Cúcuta, Norte de Santander, Colombia',
    reference: 'Sede de recepción de paquetes',
  },
  socials: [
    { label: 'Instagram', href: 'https://instagram.com/venviosexpress' },
    { label: 'Facebook', href: 'https://facebook.com/venviosexpress' },
    { label: 'TikTok', href: 'https://tiktok.com/@venviosexpress' },
  ],
  handle: '@venviosexpress',
  route: 'Colombia → Venezuela',
  hours: 'Lun a sáb · 8:00 a 18:00',
} as const;

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${BRAND.whatsappRaw}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
