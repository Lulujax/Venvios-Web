import { useState } from 'react';
import { Alerta, Campo, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD, aNumero } from '../../lib/formato';
import type { Envio, Modalidad } from '../../lib/tipos';

export function SelectorModalidad({ envio, alCambiar, leyendaVisible = false }: { envio: Envio; alCambiar: (envio: Envio) => void; leyendaVisible?: boolean }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function elegir(modalidad: Modalidad) {
    if (modalidad === envio.modalidad) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api.patch<{ envio: Envio }>(`/envios/${envio.id}`, { modalidad });
      alCambiar(r.envio);
      avisar('Modalidad actualizada.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <fieldset disabled={ocupado} className="space-y-3">
      <legend className={leyendaVisible ? 'etiqueta' : 'sr-only'}>Modalidad de cobro</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['M2', 'M1'] as Modalidad[]).map((modalidad) => (
          <label key={modalidad} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${envio.modalidad === modalidad ? 'border-marino bg-marino-50' : 'border-linea bg-white'}`}>
            <input type="radio" name="modalidad" className="sr-only" checked={envio.modalidad === modalidad} onChange={() => void elegir(modalidad)} />
            <span className="block font-display text-lg font-bold text-marino-900">{NOMBRE_MODALIDAD[modalidad]}</span>
            <span className="mt-1 block text-sm text-suave">{DESCRIPCION_MODALIDAD[modalidad]}</span>
          </label>
        ))}
      </div>
      {envio.modalidadSugerida === 'M2' && envio.modalidad === 'M1' && <Alerta tono="info">Con menos de 2 kg, el cobro a destino suele salir más barato. En “todo incluido” se cobra un mínimo de 2 kg.</Alerta>}
      {error && <Alerta tono="error">{error}</Alerta>}
    </fieldset>
  );
}

export function EditarValorYTransportista({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [valor, setValor] = useState((envio.valorDeclaradoCentavos / 100).toFixed(2));
  const [transportista, setTransportista] = useState(envio.transportista);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    try {
      const r = await api.patch<{ envio: Envio }>(`/envios/${envio.id}`, { valorDeclaradoUsd: aNumero(valor), transportista });
      alCambiar(r.envio);
      avisar('Datos actualizados. Vuelve a calcular el total.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <details className="rounded-2xl border border-linea p-4">
      <summary className="cursor-pointer text-sm font-bold text-marino">Corregir valor declarado o transportista</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Valor declarado ($)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        <div>
          <label htmlFor="edit-transp" className="etiqueta">Transportista</label>
          <select id="edit-transp" className="campo" value={transportista} onChange={(e) => setTransportista(e.target.value as Envio['transportista'])}>
            <option value="MRW">MRW</option>
            <option value="ZOOM">Zoom</option>
          </select>
        </div>
      </div>
      {error && <Alerta tono="error" className="mt-3">{error}</Alerta>}
      <button type="button" className="btn btn-primario btn-chico mt-4" onClick={() => void guardar()}>Guardar valor y transportista</button>
    </details>
  );
}
