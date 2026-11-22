export interface ResultadoLote {
  exitosos: string[];
  fallidos: Array<{ id: string; motivo: string }>;
}

export function resumenDeLote(resultado: ResultadoLote, singular: string, plural: string): string {
  const hechos = resultado.exitosos.length;
  const principal = `${hechos} ${hechos === 1 ? singular : plural}.`;
  const fallidos = resultado.fallidos.length;
  if (fallidos === 0) return principal;
  const motivos = resultado.fallidos.map((f) => f.motivo).filter((motivo, i, lista) => lista.indexOf(motivo) === i);
  return `${principal} ${fallidos} no se ${fallidos === 1 ? 'pudo' : 'pudieron'} completar: ${motivos.join('; ')}`;
}

export function trozosDe<T>(lista: T[], tamano: number): T[][] {
  if (!Number.isInteger(tamano) || tamano < 1) throw new Error('El tamaño del trozo debe ser un entero mayor que cero.');
  const trozos: T[][] = [];
  for (let inicio = 0; inicio < lista.length; inicio += tamano) trozos.push(lista.slice(inicio, inicio + tamano));
  return trozos;
}

export function sumarResultados(resultados: ResultadoLote[]): ResultadoLote {
  return {
    exitosos: resultados.flatMap((r) => r.exitosos),
    fallidos: resultados.flatMap((r) => r.fallidos),
  };
}
