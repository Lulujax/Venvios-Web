import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheckSquare, FiPackage, FiSquare } from 'react-icons/fi';
import { EditarSeguro, EditarValorPaquete } from './EditarCotizacion';
import { PieTandas, useTandas } from '../Tandas';
import { EditarValorYTransportista, SelectorModalidad } from './ModalidadYValor';
import { PrecioCaja } from './PrecioCaja';
import { Alerta, Campo, ImagenPrivada, Seccion, useAviso } from '../ui';
import { useConfirmar } from '../Confirmar';
import { api, mensajeDeError } from '../../lib/api';
import { coincideTracking } from '../../lib/cuenta';
import { aNumero, formatearUsd, nombreTransportista, primerNombre } from '../../lib/formato';
import type { Envio, ItemBodega, PaqueteVista } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

interface PropiedadesEnvio {
  envio: Envio;
  alCambiar: (envio: Envio) => void;
}

export function sumaPesosConocidos(envio: Envio): number | null {
  if (envio.paquetes.length === 0 || envio.paquetes.some((p) => p.pesoKg === null)) return null;
  return Math.round(envio.paquetes.reduce((suma, p) => suma + (p.pesoKg ?? 0), 0) * 100) / 100;
}

export function PaquetesDelConsolidado({ envio, alCambiar }: PropiedadesEnvio) {
  const avisar = useAviso();
  const [quitando, setQuitando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pedirConfirmacion = useConfirmar();

  async function quitar(paquete: PaqueteVista) {
    if (!(await pedirConfirmacion({ titulo: '¿Quitar el paquete?', pregunta: `${paquete.tracking} se quita del envío y vuelve a la bodega del cliente.`, accion: 'Sí, quitar' }))) return;
    setQuitando(paquete.id);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/quitar-paquete`, { paqueteId: paquete.id });
      alCambiar(r.envio);
      avisar('Paquete devuelto a la bodega del cliente. Vuelve a calcular el total.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setQuitando(null);
    }
  }

  if (envio.paquetes.length === 0) {
    return <p className="rounded-2xl border border-dashed border-linea p-4 text-sm text-suave">Este envío no tiene paquetes. Agrega uno de la bodega del cliente.</p>;
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {envio.paquetes.map((paquete) => (
          <li key={paquete.id} className="rounded-2xl border border-linea px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <FiPackage className="shrink-0 text-xl text-verde" aria-hidden />
                <p className="codigo truncate">{paquete.tracking}</p>
                {paquete.tieneFoto && <ImagenPrivada ruta={paquete.fotoRuta} alt={`Foto del paquete ${paquete.tracking}`} className="h-12 w-12 shrink-0" tipo="paquete" referencia={paquete.tracking} />}
              </div>
              <button type="button" className="btn btn-suave btn-chico shrink-0" disabled={quitando !== null} aria-label={`Quitar paquete ${paquete.tracking}`} onClick={() => void quitar(paquete)}>
                Quitar paquete
              </button>
            </div>
            <div className="mt-2">
              <EditarValorPaquete key={`${paquete.id}-${paquete.valorDeclaradoCentavos}`} paquete={paquete} alCambiar={alCambiar} />
            </div>
          </li>
        ))}
      </ul>
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}

export function AgregarDeBodega({ envio, alCambiar }: PropiedadesEnvio) {
  const avisar = useAviso();
  const { datos, recargar } = useCarga(
    () => api.get<{ paquetes: ItemBodega[] }>(`/staff/bodega?q=${encodeURIComponent(envio.cliente.codigo)}`).then((r) => r.paquetes),
    [envio.id, envio.paquetes.length],
  );
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const disponibles = (datos ?? []).filter((p) => p.cliente.id === envio.cliente.id && p.tipoEnvio === 'ALERTA');
  const coinciden = disponibles.filter((p) => coincideTracking(p.tracking, busqueda));
  const tandas = useTandas(coinciden);
  const todosElegidos = coinciden.length > 0 && coinciden.every((p) => elegidos.includes(p.paqueteId));

  async function agregar() {
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/paquetes`, { paqueteIds: elegidos });
      alCambiar(r.envio);
      setElegidos([]);
      await recargar();
      avisar('Paquetes agregados. Vuelve a calcular el total.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (disponibles.length === 0) return <p className="text-sm text-suave">El cliente no tiene más paquetes en bodega.</p>;
  return (
    <div className="space-y-3">
      {disponibles.length > 10 && <Campo etiqueta="Buscar por tracking" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoComplete="off" />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-marino" aria-live="polite">{elegidos.length === 0 ? 'Todavía no elegiste paquetes.' : `${elegidos.length} paquete(s) elegidos`}</p>
        <button
          type="button"
          className="btn btn-suave btn-chico"
          disabled={coinciden.length === 0}
          onClick={() => setElegidos((actuales) => (todosElegidos ? actuales.filter((id) => !coinciden.some((p) => p.paqueteId === id)) : [...new Set([...actuales, ...coinciden.map((p) => p.paqueteId)])]))}
        >
          {todosElegidos ? 'Quitar todos' : busqueda.trim() ? `Elegir los ${coinciden.length} que coinciden` : 'Elegir todos'}
        </button>
      </div>
      {coinciden.length === 0 && <p className="text-sm text-suave">Ningún paquete coincide con esa búsqueda.</p>}
      <ul className="space-y-2">
        {tandas.visibles.map((p) => {
          const marcado = elegidos.includes(p.paqueteId);
          return (
            <li key={p.paqueteId}>
              <label className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 ${marcado ? 'border-marino bg-marino-50' : 'border-linea'}`}>
                <input type="checkbox" className="sr-only" checked={marcado} onChange={() => setElegidos((a) => (a.includes(p.paqueteId) ? a.filter((x) => x !== p.paqueteId) : [...a, p.paqueteId]))} />
                {marcado ? <FiCheckSquare className="text-2xl text-marino" aria-hidden /> : <FiSquare className="text-2xl text-suave" aria-hidden />}
                <span className="codigo truncate">{p.tracking}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
      {error && <Alerta tono="error">{error}</Alerta>}
      <button type="button" className="btn btn-primario w-full sm:w-auto" disabled={elegidos.length === 0} onClick={() => void agregar()}>
        {elegidos.length > 0 ? `Agregar ${elegidos.length} paquete(s) al envío` : 'Elige paquetes para agregar'}
      </button>
    </div>
  );
}

function ZonaCobro({ envio, alCambiar }: PropiedadesEnvio) {
  const avisar = useAviso();
  const sugerido = envio.pesoTotalKg ?? sumaPesosConocidos(envio);
  const [peso, setPeso] = useState(sugerido ? sugerido.toFixed(2) : '');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function calcular() {
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

  async function enviarCotizacion() {
    setError(null);
    try {
      const mensaje = await pedirMensaje(envio.id, 'cotizacion');
      await enviarPorWhatsApp(mensaje, null);
      avisar('WhatsApp abierto con la cotización lista.', 'info');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <>
      <Seccion titulo="2 · Peso y cobro">
        <div className="space-y-5">
          <Campo
            etiqueta="Peso total del envío (kg)"
            inputMode="decimal"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void calcular();
            }}
            placeholder="0.00"
            ayuda="Pesa todos los paquetes juntos, como salen a Venezuela."
          />
          <SelectorModalidad envio={envio} alCambiar={alCambiar} leyendaVisible />
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-papel p-4 text-sm">
            <div>
              <dt className="text-suave">Valor declarado</dt>
              <dd className="font-bold">{formatearUsd(envio.valorDeclaradoCentavos)}</dd>
            </div>
            <div>
              <dt className="text-suave">Transportista</dt>
              <dd className="font-bold">{nombreTransportista(envio.transportista)}</dd>
            </div>
          </dl>
          <EditarValorYTransportista envio={envio} alCambiar={alCambiar} />
        </div>
      </Seccion>

      <Seccion titulo="3 · Total y cotización">
        {envio.precio ? <><PrecioCaja envio={envio} /><EditarSeguro key={`${envio.precio.seguroCentavos}-${envio.precio.seguroManual}`} envio={envio} alCambiar={alCambiar} /></> : <p className="rounded-2xl border border-dashed border-linea p-4 text-sm text-suave">Todavía no hay total. Revisa el peso y pulsa «Calcular total».</p>}
        {error && <Alerta tono="error" className="mt-4">{error}</Alerta>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primario w-full sm:w-auto" disabled={ocupado || envio.paquetes.length === 0} onClick={() => void calcular()}>
            {envio.precio ? 'Recalcular total' : 'Calcular total'}
          </button>
          {envio.precio && (
            <button type="button" className="btn w-full bg-[#25D366] text-marino-900 sm:w-auto" onClick={() => void enviarCotizacion()}>
              <FaWhatsapp aria-hidden /> Enviar cotización por WhatsApp
            </button>
          )}
        </div>
      </Seccion>
    </>
  );
}

export function PasosConsolidacion({ envio, alCambiar }: PropiedadesEnvio) {
  return (
    <div className="space-y-6">
      <Seccion titulo="1 · Paquetes del envío" derecha={<span className="insignia bg-marino-100 text-marino">{envio.paquetes.length} paquete(s)</span>}>
        <PaquetesDelConsolidado envio={envio} alCambiar={alCambiar} />
        <div className="mt-6 border-t border-linea pt-5">
          <h3 className="mb-3 text-base">Agregar de la bodega de {primerNombre(envio.cliente.nombre)}</h3>
          <AgregarDeBodega envio={envio} alCambiar={alCambiar} />
        </div>
      </Seccion>
      <ZonaCobro key={`${envio.id}-${envio.paquetes.length}`} envio={envio} alCambiar={alCambiar} />
    </div>
  );
}
