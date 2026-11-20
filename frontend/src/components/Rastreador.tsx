import { useState, type FormEvent } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import type { TransportistaPublico } from '../lib/tipos';
import { Alerta } from './ui';

export function Rastreador({ transportistas }: { transportistas: TransportistaPublico[] }) {
  const [codigo, setCodigo] = useState(transportistas[0]?.codigo ?? 'MRW');
  const [error, setError] = useState<string | null>(null);

  function abrirRastreo(evento: FormEvent) {
    evento.preventDefault();
    const elegida = transportistas.find((t) => t.codigo === codigo);
    if (!elegida) {
      setError('Elige la transportista.');
      return;
    }
    setError(null);
    window.open(elegida.urlRastreo, '_blank', 'noopener');
  }

  return (
    <form onSubmit={abrirRastreo} className="space-y-3" noValidate>
      <fieldset>
        <legend className="etiqueta">¿Con quién viaja tu paquete?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-marino-50 p-1.5">
          {transportistas.map((t) => (
            <label key={t.codigo} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl text-sm font-bold transition ${codigo === t.codigo ? 'bg-marino text-white shadow-tarjeta' : 'text-marino'}`}>
              <input type="radio" name="transportista" className="sr-only" checked={codigo === t.codigo} onChange={() => setCodigo(t.codigo)} />
              {t.nombre}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-acento w-full">
        Rastrear <FiExternalLink aria-hidden className="opacity-60" />
      </button>
      {error && <Alerta tono="error">{error}</Alerta>}
    </form>
  );
}
