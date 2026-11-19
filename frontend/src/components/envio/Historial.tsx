import { useState } from 'react';
import { api, mensajeDeError } from '../../lib/api';
import { formatearFecha } from '../../lib/formato';
import type { EventoHistorial } from '../../lib/tipos';
import { Cargando } from '../ui';

export function Historial({ envioId }: { envioId: string }) {
  const [eventos, setEventos] = useState<EventoHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar(abierto: boolean) {
    if (!abierto || eventos) return;
    try {
      setEventos((await api.get<{ eventos: EventoHistorial[] }>(`/staff/envios/${envioId}/historial`)).eventos);
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <details onToggle={(e) => void cargar((e.target as HTMLDetailsElement).open)} className="rounded-2xl border border-linea p-4">
      <summary className="cursor-pointer text-sm font-bold text-marino">Historial del envío</summary>
      <div className="mt-4">
        {error && <p className="text-sm font-semibold text-rojo">{error}</p>}
        {!eventos && !error && <Cargando lineas={2} />}
        {eventos && (
          <ol className="space-y-3 border-l-2 border-linea pl-4">
            {eventos.map((evento, indice) => (
              <li key={indice} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marino" aria-hidden />
                <p className="font-bold">{evento.detalle}</p>
                <p className="text-xs text-suave">{formatearFecha(evento.fecha)} · {evento.tipo}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
