export const DATOS_EJEMPLO: Record<string, string> = {
  nombre: 'Rosa',
  tracking: 'SHN26110011',
  resumen_paquetes: '• Shein · SHN26110011 · 1.2 kg\n• Amazon · AMZ998877 · 2.0 kg',
  linea_peso: 'Peso: 3.2 kg',
  linea_total: 'Total a pagar: $48.50',
  nota_modalidad: 'Modalidad: todo incluido hasta tu puerta.',
  enlace_cuenta: 'https://venviosexpress.com/cuenta',
  enlace_consolidar: 'https://venviosexpress.com/cuenta/consolidar',
  transportista: 'MRW',
  guia: 'MRW-0012345',
  enlace_rastreo: 'https://www.mrw.com.ve/rastreo?guia=MRW-0012345',
  motivo: 'La referencia no coincide con el comprobante.',
};

export function renderizarEjemplo(plantilla: string, datos: Record<string, string> = DATOS_EJEMPLO): string {
  if (typeof plantilla !== 'string') throw new Error('La plantilla debe ser texto.');
  const originales = plantilla.split('\n');
  const resultado: string[] = [];
  originales.forEach((original) => {
    const linea = original.replace(/\{(\w+)\}/g, (_, clave: string) => datos[clave] ?? '');
    const eraSoloVariable = /^\s*\{\w+\}\s*$/.test(original);
    if (eraSoloVariable && linea.trim() === '') return;
    resultado.push(linea);
  });
  return resultado.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function variablesDesconocidas(plantilla: string, datos: Record<string, string> = DATOS_EJEMPLO): string[] {
  const encontradas = Array.from(plantilla.matchAll(/\{(\w+)\}/g), (m) => m[1]!);
  return Array.from(new Set(encontradas.filter((clave) => !(clave in datos))));
}

export function enlacePruebaWhatsApp(whatsappEmpresa: string, texto: string): string | null {
  const digitos = (whatsappEmpresa ?? '').replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return null;
  if (!texto.trim()) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
