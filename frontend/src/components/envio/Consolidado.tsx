import { useState, type FormEvent } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { Alerta, Campo, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, formatearUsd } from '../../lib/formato';
import type { Envio, ItemBodega } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

export function sumaPesosConocidos(envio: Envio): number | null {
  if (envio.paquetes.length === 0 || envio.paquetes.some((p) => p.pesoKg === null)) return null;
  return Math.round(envio.paquetes.reduce((suma, p) => suma + (p.pesoKg ?? 0), 0) * 100) / 100;
}

export function CotizarConsolidado({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const sugerido = envio.pesoTotalKg ?? sumaPesosConocidos(envio);
  const [peso, setPeso] = useState(sugerido ? sugerido.toFixed(2) : '');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cotizar(evento: FormEvent) {
    evento.preventDefault();
    const kilos = aNumero(peso);
    if (!Number.isFinite(kilos) || kilos <= 0) return setError('Escribe el peso total del envío en kg.');
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/cotizar`, { pesoKg: kilos });
      alCambiar(r.envio);
      avisar(`Total calculado: ${formatearUsd(r.envio.precio?.totalCentavos)}.`);
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  async function avisarTotal() {
    setError(null);
    try {
      const mensaje = await pedirMensaje(envio.id, 'cotizacion');
      await enviarPorWhatsApp(mensaje, null);
      avisar('WhatsApp abierto con el total listo.', 'info');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={cotizar} className="flex flex-wrap items-end gap-2" noValidate>
        <div className="min-w-[160px] flex-1">
          <Campo etiqueta="Peso total del envío (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0.00" ayuda={sumaPesosConocidos(envio) !== null ? `La suma de los paquetes da ${sumaPesosConocidos(envio)!.toFixed(2)} kg.` : 'Pesa todo junto como sale a Venezuela.'} />
        </div>
        <button type="submit" className="btn btn-primario" disabled={ocupado}>{envio.precio ? 'Recalcular total' : 'Calcular total'}</button>
      </form>
      {envio.precio && (
        <button type="button" className="btn bg-[#25D366] text-marino-900" onClick={() => void avisarTotal()}>
          <FaWhatsapp aria-hidden /> Enviar total por WhatsApp
        </button>
      )}
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}

export function AgregarDeBodega({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const { datos, recargar } = useCarga(
    () => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?q=${encodeURIComponent(envio.cliente.codigo)}`).then((r) => r.paquetes),
    [envio.id, envio.paquetes.length],
  );
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const disponibles = (datos ?? []).filter((p) => p.cliente.id === envio.cliente.id && p.tipoEnvio === 'ALERTA');

  async function agregar() {
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/paquetes`, { paqueteIds: elegidos });
      alCambiar(r.envio);
      setElegidos([]);
      await recargar();
      avisar('Paquetes agregados. Vuelve a pesar el envío.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (disponibles.length === 0) return <p className="text-sm text-suave">El cliente no tiene más paquetes en bodega.</p>;
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {disponibles.map((p) => {
          const marcado = elegidos.includes(p.paqueteId);
          return (
            <li key={p.paqueteId}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 ${marcado ? 'border-marino bg-marino-50' : 'border-linea'}`}>
                <input type="checkbox" className="sr-only" checked={marcado} onChange={() => setElegidos((a) => (a.includes(p.paqueteId) ? a.filter((x) => x !== p.paqueteId) : [...a, p.paqueteId]))} />
                {marcado ? <FiCheckSquare className="text-xl text-marino" aria-hidden /> : <FiSquare className="text-xl text-suave" aria-hidden />}
                <span className="codigo truncate">{p.tracking}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <Alerta tono="error">{error}</Alerta>}
      <button type="button" className="btn btn-suave btn-chico" disabled={elegidos.length === 0} onClick={() => void agregar()}>Agregar al envío</button>
    </div>
  );
}
