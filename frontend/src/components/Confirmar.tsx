import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { crearRegistro } from '../lib/registro';

const registro = crearRegistro('confirmar');

export interface OpcionesConfirmar {
  titulo: string;
  pregunta: string;
  accion: string;
  cancelar?: string;
  peligro?: boolean;
}

type Pedir = (opciones: OpcionesConfirmar) => Promise<boolean>;

interface Pendiente {
  opciones: OpcionesConfirmar;
  resolver: (confirmado: boolean) => void;
}

const ContextoConfirmar = createContext<Pedir>(() =>
  Promise.reject(new Error('Falta ConfirmarProvider: envuelve la aplicación con él.')),
);

export function ProveedorConfirmar({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const pedir = useCallback<Pedir>(
    (opciones) =>
      new Promise<boolean>((resolver) => {
        registro.info('Pidiendo confirmación');
        setPendiente({ opciones, resolver });
      }),
    [],
  );

  const responder = useCallback(
    (confirmado: boolean) => {
      registro.info(confirmado ? 'Acción confirmada' : 'Acción cancelada');
      setPendiente((actual) => {
        actual?.resolver(confirmado);
        return null;
      });
    },
    [],
  );

  return (
    <ContextoConfirmar.Provider value={pedir}>
      {children}
      {pendiente && <DialogoConfirmar opciones={pendiente.opciones} alResponder={responder} />}
    </ContextoConfirmar.Provider>
  );
}

export function useConfirmar(): Pedir {
  return useContext(ContextoConfirmar);
}

function DialogoConfirmar({ opciones, alResponder }: { opciones: OpcionesConfirmar; alResponder: (confirmado: boolean) => void }) {
  const idTitulo = useId();
  const idPregunta = useId();
  const botonCancelar = useRef<HTMLButtonElement>(null);
  const alResponderActual = useRef(alResponder);
  alResponderActual.current = alResponder;

  useEffect(() => {
    const enfocadoAntes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desplazamientoAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botonCancelar.current?.focus();

    const alTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alResponderActual.current(false);
    };
    document.addEventListener('keydown', alTeclar);

    return () => {
      document.removeEventListener('keydown', alTeclar);
      document.body.style.overflow = desplazamientoAntes;
      enfocadoAntes?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-marino-900/60 p-4 backdrop-blur-sm" onClick={() => alResponder(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idPregunta}
        className="tarjeta relative w-full max-w-md p-6 shadow-elevada animate-entrar"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button type="button" aria-label="Cerrar aviso" onClick={() => alResponder(false)} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-suave hover:bg-marino-50">
          <FiX aria-hidden />
        </button>
        <h2 id={idTitulo} className="pr-10 text-xl">{opciones.titulo}</h2>
        <p id={idPregunta} className="mt-2 text-suave">{opciones.pregunta}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={botonCancelar} type="button" className="btn btn-suave" onClick={() => alResponder(false)}>
            {opciones.cancelar ?? 'Mejor no'}
          </button>
          <button type="button" className={`btn ${opciones.peligro ? 'btn-peligro' : 'btn-primario'}`} onClick={() => alResponder(true)}>
            {opciones.accion}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
