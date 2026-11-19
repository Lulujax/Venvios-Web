import { useState, type FormEvent } from 'react';
import { FiExternalLink, FiSearch } from 'react-icons/fi';
import { enlaceRastreo } from '../lib/whatsapp';
import type { TransportistaPublico } from '../lib/tipos';
import { Alerta } from './ui';

export function Rastreador({ transportistas }: { transportistas: TransportistaPublico[] }) {
  const [codigo, setCodigo] = useState(transportistas[0]?.codigo ?? 'MRW');
  const [guia, setGuia] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rastrear(evento: FormEvent) {
    evento.preventDefault();
    const limpia = guia.trim();
    const elegida = transportistas.find((t) => t.codigo === codigo);
    if (!elegida) return setError('Elige la transportista.');
    if (limpia.length < 4) return setError('Escribe el número de guía completo.');
    setError(null);
    let copiada = false;
    try {
      await navigator.clipboard.writeText(limpia);
      copiada = true;
    } catch {
      copiada = false;
    }
    window.open(enlaceRastreo(elegida.urlRastreo, elegida.parametroGuia, limpia), '_blank', 'noopener');
    setAviso(
      elegida.parametroGuia
        ? `Abrimos ${elegida.nombre} con tu guía.`
        : copiada
          ? `Copiamos tu guía. Pégala en la página de ${elegida.nombre}.`
          : `Abrimos ${elegida.nombre}. Escribe allí tu número de guía.`,
    );
  }

  return (
    <form onSubmit={rastrear} className="space-y-3" noValidate>
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
      <div>
        <label htmlFor="guia-rastreo" className="etiqueta">Número de guía</label>
        <input id="guia-rastreo" className="campo font-mono" value={guia} onChange={(e) => setGuia(e.target.value)} placeholder="Ej. 4012345678" autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-acento w-full">
        <FiSearch aria-hidden /> Rastrear <FiExternalLink aria-hidden className="opacity-60" />
      </button>
      {error && <Alerta tono="error">{error}</Alerta>}
      {aviso && <Alerta tono="ok">{aviso}</Alerta>}
    </form>
  );
}
