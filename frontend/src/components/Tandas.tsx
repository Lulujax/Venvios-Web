import { useEffect, useState } from 'react';

export const TAMANO_TANDA = 10;

export function useTandas<T>(items: T[], tamano: number = TAMANO_TANDA) {
  const [cantidad, setCantidad] = useState(tamano);

  useEffect(() => {
    setCantidad(tamano);
  }, [items.length, tamano]);

  return {
    visibles: items.slice(0, cantidad),
    total: items.length,
    mostrados: Math.min(cantidad, items.length),
    hayMas: cantidad < items.length,
    verMas: () => setCantidad((actual) => actual + tamano),
  };
}

interface PieTandasProps {
  total: number;
  mostrados: number;
  hayMas: boolean;
  verMas: () => void;
  tamano?: number;
}

export function PieTandas({ total, mostrados, hayMas, verMas, tamano = TAMANO_TANDA }: PieTandasProps) {
  if (total <= tamano) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-suave" aria-live="polite">Mostrando {mostrados} de {total}</p>
      {hayMas && (
        <button type="button" className="btn btn-suave" onClick={verMas}>
          Ver {tamano} más
        </button>
      )}
    </div>
  );
}
