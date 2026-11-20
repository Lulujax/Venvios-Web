import { DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD } from '../lib/formato';
import type { Modalidad, Transportista } from '../lib/tipos';

export function ElegirTransportista({ valor, alCambiar, nombre = 'transportista' }: { valor: Transportista; alCambiar: (valor: Transportista) => void; nombre?: string }) {
  return (
    <fieldset>
      <legend className="etiqueta">¿Con quién se envía a Venezuela?</legend>
      <div className="grid grid-cols-2 gap-3">
        {(['MRW', 'ZOOM'] as Transportista[]).map((t) => (
          <label key={t} className={`flex min-h-[56px] cursor-pointer items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition focus-within:ring-4 focus-within:ring-marino/20 ${valor === t ? 'border-marino bg-marino text-white' : 'border-linea bg-white text-marino-900'}`}>
            <input type="radio" name={nombre} className="sr-only" checked={valor === t} onChange={() => alCambiar(t)} />
            {t === 'ZOOM' ? 'Zoom' : 'MRW'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ElegirModalidad({ valor, alCambiar, nombre = 'modalidad' }: { valor: Modalidad; alCambiar: (valor: Modalidad) => void; nombre?: string }) {
  return (
    <fieldset>
      <legend className="etiqueta">¿Cómo prefieres pagar?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['M2', 'M1'] as Modalidad[]).map((m) => (
          <label key={m} className={`cursor-pointer rounded-2xl border-2 p-4 transition focus-within:ring-4 focus-within:ring-marino/20 ${valor === m ? 'border-marino bg-marino-50' : 'border-linea bg-white'}`}>
            <input type="radio" name={nombre} className="sr-only" checked={valor === m} onChange={() => alCambiar(m)} />
            <span className="block font-display text-lg font-bold text-marino-900">{NOMBRE_MODALIDAD[m]}</span>
            <span className="mt-1 block text-sm text-suave">{DESCRIPCION_MODALIDAD[m]}</span>
          </label>
        ))}
      </div>
      <p className="ayuda">Si tu envío pesa menos de 2 kg, el cobro a destino suele salir más barato. Puedes cambiarlo antes de pagar.</p>
    </fieldset>
  );
}
