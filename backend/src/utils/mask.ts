export function enmascararCedula(cedula: string): string {
  const digitos = cedula.replace(/\D/g, '');
  if (digitos.length < 4) return '***';
  return `V-***${digitos.slice(-3)}`;
}

export function enmascararTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 6) return '***';
  return `+${digitos.slice(0, 2)}******${digitos.slice(-2)}`;
}

export function enmascararNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primero = partes[0] ?? '';
  if (primero.length === 0) return '***';
  const inicialSegundo = partes.length > 1 ? ` ${partes[1]!.charAt(0)}.` : '';
  return `${primero}${inicialSegundo}`;
}
