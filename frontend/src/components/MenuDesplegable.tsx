import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

export function useMenuDesplegable() {
  const [abierto, setAbierto] = useState(false);
  const ubicacion = useLocation();

  useEffect(() => {
    setAbierto(false);
  }, [ubicacion.pathname, ubicacion.search]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return { abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false) };
}

export function BotonMenu({ alAbrir }: { alAbrir: () => void }) {
  return (
    <button type="button" className="btn btn-suave btn-chico hidden lg:inline-flex" onClick={alAbrir} aria-label="Abrir menú">
      <FiMenu aria-hidden /> Menú
    </button>
  );
}

export function MenuDesplegable({ abierto, alCerrar, etiqueta, children }: { abierto: boolean; alCerrar: () => void; etiqueta: string; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 hidden lg:block">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-marino-900/40" aria-label="Cerrar menú" onClick={alCerrar} />
      <aside role="dialog" aria-modal="true" aria-label={etiqueta} className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between overflow-y-auto bg-white p-5 shadow-elevada">
        <button type="button" className="btn btn-fantasma btn-chico absolute right-3 top-3" onClick={alCerrar} aria-label="Cerrar menú">
          <FiX aria-hidden />
        </button>
        {children}
      </aside>
    </div>
  );
}
