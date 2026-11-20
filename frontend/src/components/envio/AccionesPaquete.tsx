import { useState } from 'react';
import { BuscadorCliente } from '../BuscadorCliente';
import { Alerta, Campo, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import type { Envio, Usuario } from '../../lib/tipos';

interface AccionProps {
  paqueteId: string;
  tracking: string;
  alTerminar: (envio: Envio) => void;
  alCancelar: () => void;
}

export function CambiarDueno({ paqueteId, tracking, sinDueno, alTerminar, alCancelar }: AccionProps & { sinDueno: boolean }) {
  const avisar = useAviso();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function asignar(clienteId: string | null) {
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${paqueteId}/asignar`, { clienteId, motivo: motivo.trim() || undefined });
      avisar(clienteId ? `Paquete ${tracking} asignado a ${cliente?.nombre ?? 'el cliente'}.` : `Paquete ${tracking} quedó sin dueño.`);
      alTerminar(r.envio);
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-marino/20 bg-marino-50/60 p-4">
      <p className="text-sm font-bold text-marino-900">{sinDueno ? 'Asignar dueño' : 'Cambiar dueño'} de <span className="codigo">{tracking}</span></p>
      <BuscadorCliente cliente={cliente} onElegir={setCliente} etiqueta="Nuevo dueño" />
      <Campo etiqueta="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: la etiqueta trae el casillero del cliente" />
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primario btn-chico" disabled={!cliente || ocupado} onClick={() => cliente && void asignar(cliente.id)}>Asignar</button>
        {!sinDueno && <button type="button" className="btn btn-suave btn-chico" disabled={ocupado} onClick={() => void asignar(null)}>Dejar sin dueño</button>}
        <button type="button" className="btn btn-fantasma btn-chico" onClick={alCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export function DescartarPaquete({ paqueteId, tracking, alTerminar, alCancelar }: AccionProps) {
  const avisar = useAviso();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function descartar() {
    if (motivo.trim().length < 3) return setError('Escribe el motivo (mínimo 3 letras).');
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${paqueteId}/descartar`, { motivo: motivo.trim() });
      avisar(`Paquete ${tracking} descartado.`);
      alTerminar(r.envio);
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-rojo/30 bg-rojo-100/40 p-4">
      <p className="text-sm font-bold text-rojo-700">Descartar <span className="codigo">{tracking}</span></p>
      <Campo etiqueta="Motivo del descarte" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: llegó dañado y el cliente pidió desecharlo" error={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-peligro btn-chico" disabled={ocupado} onClick={() => void descartar()}>Descartar paquete</button>
        <button type="button" className="btn btn-fantasma btn-chico" onClick={alCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
