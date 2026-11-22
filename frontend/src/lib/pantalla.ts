import { useEffect, useState } from 'react';

export const ANCHO_ESCRITORIO_PX = 1280;

function hayMediaQuery(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function useEsEscritorio(minimoPx: number = ANCHO_ESCRITORIO_PX): boolean {
  if (!Number.isFinite(minimoPx) || minimoPx <= 0) throw new Error('El ancho mínimo debe ser un número mayor que cero.');
  const consulta = `(min-width: ${minimoPx}px)`;
  const [escritorio, setEscritorio] = useState<boolean>(() => (hayMediaQuery() ? window.matchMedia(consulta).matches : true));

  useEffect(() => {
    if (!hayMediaQuery()) return undefined;
    const lista = window.matchMedia(consulta);
    const actualizar = () => setEscritorio(lista.matches);
    actualizar();
    lista.addEventListener('change', actualizar);
    return () => lista.removeEventListener('change', actualizar);
  }, [consulta]);

  return escritorio;
}
