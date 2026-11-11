/**
 * Enmascaramiento de PII para logs y respuestas administrativas.
 * Regla de oro: el operador nunca ve el teléfono del cliente.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '******';
  const prefix = phone.trim().startsWith('+') ? `+${digits.slice(0, 2)}` : '';
  return `${prefix}******${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(3, local.length - 1))}@${domain}`;
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts
    .map((part, index) => {
      if (index === 0) return part;
      return `${part.slice(0, 1).toUpperCase()}.`;
    })
    .join(' ');
}

/** Sustituye correos y teléfonos embebidos en un texto libre. */
export function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, (match) => maskEmail(match))
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, (match) => maskPhone(match));
}
