import { AppError } from '../utils/errors';

export interface EnlacesWhatsApp {
  movil: string;
  web: string;
  texto: string;
}

export function construirEnlacesWhatsApp(telefono: string, texto: string): EnlacesWhatsApp {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) {
    throw AppError.badRequest('El teléfono del cliente no es válido para WhatsApp.', 'TELEFONO_INVALIDO');
  }
  if (!texto || !texto.trim()) throw AppError.badRequest('El mensaje no puede estar vacío.');
  const codificado = encodeURIComponent(texto);
  return {
    movil: `https://wa.me/${digitos}?text=${codificado}`,
    web: `https://web.whatsapp.com/send?phone=${digitos}&text=${codificado}`,
    texto,
  };
}

export function renderizarPlantilla(plantilla: string, variables: Record<string, string | number | null | undefined>): string {
  if (!plantilla) throw AppError.badRequest('La plantilla está vacía.');
  const lineas = plantilla.split('\n').map((linea) =>
    linea.replace(/\{(\w+)\}/g, (_, clave: string) => {
      const valor = variables[clave];
      return valor === null || valor === undefined ? '' : String(valor);
    }),
  );
  const resultado: string[] = [];
  lineas.forEach((linea, indice) => {
    const original = plantilla.split('\n')[indice] ?? '';
    const eraSoloVariable = /^\s*\{\w+\}\s*$/.test(original);
    if (eraSoloVariable && linea.trim() === '') return;
    resultado.push(linea);
  });
  return resultado.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
