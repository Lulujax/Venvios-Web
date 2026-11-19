import { FiCheck } from 'react-icons/fi';
import { ETIQUETAS_ESTADO, PASOS_ENVIO, pasoActual } from '../../lib/formato';
import type { EstadoEnvio } from '../../lib/tipos';

export function LineaEstado({ estado }: { estado: EstadoEnvio }) {
  const actual = pasoActual(estado);
  if (estado === 'CANCELADO') return <p className="rounded-2xl bg-rojo-100 px-4 py-3 text-sm font-bold text-rojo-700">Este envío fue cancelado.</p>;
  return (
    <ol className="flex items-start gap-1 overflow-x-auto pb-1" aria-label="Progreso del envío">
      {PASOS_ENVIO.map((paso, indice) => {
        const hecho = indice < actual;
        const ahora = indice === actual;
        return (
          <li key={paso} className="flex min-w-[76px] flex-1 flex-col items-center text-center" aria-current={ahora ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-1 flex-1 ${indice === 0 ? 'opacity-0' : hecho || ahora ? 'bg-marino' : 'bg-linea'}`} />
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold ${hecho ? 'border-marino bg-marino text-white' : ahora ? 'border-oro bg-oro text-marino-900' : 'border-linea bg-white text-suave'}`}>
                {hecho ? <FiCheck aria-hidden /> : indice + 1}
              </span>
              <span className={`h-1 flex-1 ${indice === PASOS_ENVIO.length - 1 ? 'opacity-0' : hecho ? 'bg-marino' : 'bg-linea'}`} />
            </div>
            <span className={`mt-1.5 text-[11px] font-bold leading-tight ${ahora ? 'text-marino-900' : 'text-suave'}`}>{ETIQUETAS_ESTADO[paso]}</span>
          </li>
        );
      })}
    </ol>
  );
}
