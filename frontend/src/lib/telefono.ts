export interface Pais {
  codigo: string;
  nombre: string;
  prefijo: string;
  ejemplo: string;
}

export const PAIS_PREDETERMINADO = 'VE';

export const PAISES: Pais[] = [
  { codigo: 'VE', nombre: 'Venezuela', prefijo: '58', ejemplo: '4241234567' },
  { codigo: 'CO', nombre: 'Colombia', prefijo: '57', ejemplo: '3001234567' },
  { codigo: 'US', nombre: 'Estados Unidos', prefijo: '1', ejemplo: '3055551234' },
  { codigo: 'ES', nombre: 'España', prefijo: '34', ejemplo: '612345678' },
  { codigo: 'PE', nombre: 'Perú', prefijo: '51', ejemplo: '912345678' },
  { codigo: 'EC', nombre: 'Ecuador', prefijo: '593', ejemplo: '991234567' },
  { codigo: 'CL', nombre: 'Chile', prefijo: '56', ejemplo: '912345678' },
  { codigo: 'AR', nombre: 'Argentina', prefijo: '54', ejemplo: '1123456789' },
  { codigo: 'PA', nombre: 'Panamá', prefijo: '507', ejemplo: '61234567' },
  { codigo: 'MX', nombre: 'México', prefijo: '52', ejemplo: '5512345678' },
  { codigo: 'BR', nombre: 'Brasil', prefijo: '55', ejemplo: '11912345678' },
];

export function buscarPais(codigo: string): Pais {
  const encontrado = PAISES.find((pais) => pais.codigo === codigo);
  if (!encontrado) throw new Error(`País desconocido: ${codigo}`);
  return encontrado;
}

export function componerTelefono(codigoPais: string, numeroLocal: string): string {
  const pais = buscarPais(codigoPais);
  const digitos = numeroLocal.replace(/\D/g, '').replace(/^0+/, '');
  return `${pais.prefijo}${digitos}`;
}

export function validarTelefonoLocal(codigoPais: string, numeroLocal: string): string | null {
  const pais = buscarPais(codigoPais);
  const digitos = numeroLocal.replace(/\D/g, '').replace(/^0+/, '');
  if (digitos.length < 7) return `Escribe tu número sin el código de país, por ejemplo ${pais.ejemplo}.`;
  const total = pais.prefijo.length + digitos.length;
  if (total < 10 || total > 15) return `Revisa el número: debe verse como ${pais.ejemplo}.`;
  return null;
}
