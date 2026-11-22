import { useEffect, useRef, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { guardarFotoEnDispositivo, type TipoFoto } from '../lib/descarga';

export interface DatosDescarga {
  ruta: string | null;
  tipo: TipoFoto;
  referencia: string;
}

export function useDescargaFoto(datos: DatosDescarga | null) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar(): Promise<void> {
    if (!datos) return;
    setDescargando(true);
    setError(null);
    try {
      await guardarFotoEnDispositivo(datos.ruta, datos.tipo, datos.referencia);
    } catch (falla) {
      setError(falla instanceof Error ? falla.message : 'No pudimos descargar la foto.');
    } finally {
      setDescargando(false);
    }
  }

  return { descargar, descargando, error };
}

interface BotonDescargarProps {
  descargando: boolean;
  alDescargar: () => void;
  chico?: boolean;
}

export function BotonDescargar({ descargando, alDescargar, chico = true }: BotonDescargarProps) {
  return (
    <button type="button" className={`btn btn-suave ${chico ? 'btn-chico' : ''}`} disabled={descargando} onClick={alDescargar}>
      <FiDownload aria-hidden /> {descargando ? 'Descargando…' : 'Descargar foto'}
    </button>
  );
}

interface VisorFotoProps {
  url: string;
  alt: string;
  alCerrar: () => void;
  descarga: ReturnType<typeof useDescargaFoto> | null;
}

export function VisorFoto({ url, alt, alCerrar, descarga }: VisorFotoProps) {
  const botonCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botonCerrar.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-marino-900/85 p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      <button
        ref={botonCerrar}
        type="button"
        aria-label="Cerrar foto"
        className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white text-2xl text-marino-900 shadow-elevada"
        onClick={alCerrar}
      >
        <FiX aria-hidden />
      </button>
      <img src={url} alt={alt} className="max-h-[75dvh] max-w-full rounded-2xl bg-white object-contain" />
      {descarga && (
        <div className="flex flex-col items-center gap-2">
          <BotonDescargar descargando={descarga.descargando} alDescargar={() => void descarga.descargar()} chico={false} />
          {descarga.error && <p role="alert" className="rounded-xl bg-rojo-100 px-3 py-2 text-sm font-semibold text-rojo-700">{descarga.error}</p>}
        </div>
      )}
    </div>
  );
}
