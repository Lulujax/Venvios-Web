import { formatearFecha } from '../../lib/formato';
import type { PaqueteVista } from '../../lib/tipos';

export function SeguimientoPaquete({ paquete }: { paquete: PaqueteVista }) {
  const pasos = paquete.seguimiento ?? [];
  if (pasos.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1.5 border-l-2 border-linea pl-4" aria-label={`Seguimiento del paquete ${paquete.tracking}`}>
      {pasos.map((paso, indice) => {
        const actual = indice === pasos.length - 1;
        return (
          <li key={`${paso.tipo}-${paso.fecha}`} className="relative text-sm">
            <span aria-hidden className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${actual ? 'bg-oro ring-4 ring-oro/30' : 'bg-marino'}`} />
            <span className={actual ? 'font-bold text-marino-900' : 'text-suave'}>{paso.etiqueta}</span>
            <span className="ml-2 text-xs text-suave">{formatearFecha(paso.fecha)}</span>
          </li>
        );
      })}
    </ol>
  );
}
