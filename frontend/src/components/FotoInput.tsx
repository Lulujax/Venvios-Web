import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiImage, FiX } from 'react-icons/fi';
import { comprimirImagen } from '../lib/imagenes';
import { mensajeDeError } from '../lib/api';

interface FotoInputProps {
  etiqueta: string;
  archivo: File | null;
  onChange: (archivo: File | null) => void;
  usarCamara?: boolean;
  disabled?: boolean;
}

export function FotoInput({ etiqueta, archivo, onChange, usarCamara = false, disabled = false }: FotoInputProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (!archivo) {
      setVista(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  async function elegir(lista: FileList | null) {
    const original = lista?.[0];
    if (!original) return;
    setProcesando(true);
    setError(null);
    try {
      onChange(await comprimirImagen(original));
    } catch (falla) {
      setError(mensajeDeError(falla));
      onChange(null);
    } finally {
      setProcesando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  return (
    <div>
      <span className="etiqueta">{etiqueta}</span>
      <input ref={entrada} type="file" accept="image/*" capture={usarCamara ? 'environment' : undefined} className="sr-only" onChange={(e) => void elegir(e.target.files)} disabled={disabled || procesando} aria-label={etiqueta} />
      {vista ? (
        <div className="flex items-center gap-3 rounded-2xl border border-linea bg-white p-2">
          <img src={vista} alt="Vista previa" className="h-16 w-16 rounded-xl object-cover" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{archivo ? `${(archivo.size / 1024).toFixed(0)} KB listos` : ''}</p>
          <button type="button" className="btn btn-suave btn-chico" onClick={() => onChange(null)} aria-label="Quitar imagen"><FiX aria-hidden /></button>
        </div>
      ) : (
        <button type="button" className="btn btn-suave w-full border-dashed" onClick={() => entrada.current?.click()} disabled={disabled || procesando}>
          {usarCamara ? <FiCamera aria-hidden /> : <FiImage aria-hidden />}
          {procesando ? 'Preparando…' : usarCamara ? 'Tomar foto' : 'Elegir imagen'}
        </button>
      )}
      {error && <p className="ayuda font-semibold text-rojo" role="alert">{error}</p>}
    </div>
  );
}
