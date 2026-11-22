import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { crearRegistro } from '../lib/registro';

const registro = crearRegistro('dialogo');

export function Dialogo({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  const idTitulo = useId();
  const alCerrarActual = useRef(alCerrar);
  alCerrarActual.current = alCerrar;

  useEffect(() => {
    registro.info('Cuadro abierto');
    const enfocadoAntes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desplazamientoAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrarActual.current();
    };
    document.addEventListener('keydown', alTeclar);

    return () => {
      registro.info('Cuadro cerrado');
      document.removeEventListener('keydown', alTeclar);
      document.body.style.overflow = desplazamientoAntes;
      enfocadoAntes?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-marino-900/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className="tarjeta relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none shadow-elevada animate-entrar sm:rounded-b-tarjeta">
        <div className="flex items-center justify-between gap-3 border-b border-linea px-5 py-4">
          <h2 id={idTitulo} className="text-xl">{titulo}</h2>
          <button type="button" aria-label="Cerrar cuadro" onClick={alCerrar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-suave hover:bg-marino-50">
            <FiX aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
