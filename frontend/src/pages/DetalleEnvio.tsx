import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPhone } from 'react-icons/fi';
import { AjusteAdmin } from '../components/envio/AjusteAdmin';
import { DespachoForm } from '../components/envio/DespachoForm';
import { EntregaForm } from '../components/envio/EntregaForm';
import { Historial } from '../components/envio/Historial';
import { LineaEstado } from '../components/envio/LineaEstado';
import { PagoCliente } from '../components/envio/PagoCliente';
import { ListaPagos, PagosPersonal } from '../components/envio/PagosPersonal';
import { PaquetesCliente, PaquetesPersonal } from '../components/envio/PaquetesLista';
import { PrecioCaja } from '../components/envio/PrecioCaja';
import { AgregarDeBodega, CotizarConsolidado } from '../components/envio/Consolidado';
import { Alerta, Campo, Cargando, ErrorCarga, ImagenPrivada, InsigniaEstado, Seccion, useAviso } from '../components/ui';
import { api, mensajeDeError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD, aNumero, formatearUsd, nombreTransportista } from '../lib/formato';
import type { Envio, Modalidad } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';
import { enlaceRastreo } from '../lib/whatsapp';


function SelectorModalidad({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
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
      <legend className="sr-only">Modalidad de cobro</legend>
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

function EditarDatosPersonal({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [valor, setValor] = useState((envio.valorDeclaradoCentavos / 100).toFixed(2));
  const [transportista, setTransportista] = useState(envio.transportista);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    try {
      const r = await api.patch<{ envio: Envio }>(`/envios/${envio.id}`, { valorDeclaradoUsd: aNumero(valor), transportista });
      alCambiar(r.envio);
      avisar('Datos actualizados.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <details className="rounded-2xl border border-linea p-4">
      <summary className="cursor-pointer text-sm font-bold text-marino">Editar valor declarado y transportista</summary>
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
      <button type="button" className="btn btn-primario btn-chico mt-4" onClick={() => void guardar()}>Guardar</button>
    </details>
  );
}

const ESTADOS_ALERTA_ACTIVOS = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];
const ESTADOS_CONSOLIDADO_ABIERTOS = ['POR_CONSOLIDAR', 'POR_PAGAR'];
const ESTADOS_CERRADOS = ['DESPACHADO', 'CERRADO', 'CANCELADO', 'ARCHIVADO'];

function tituloDe(envio: Envio): string {
  if (envio.tipo === 'CONSOLIDADO') return 'Envío consolidado';
  if (envio.tienda === 'Sin prealerta') return 'Paquete sin prealerta';
  if (envio.tienda === 'Devuelto a bodega') return 'Paquete en bodega';
  return `Alerta de ${envio.tienda}`;
}

function DescartarEnvio({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const esConsolidado = envio.tipo === 'CONSOLIDADO';

  async function confirmar() {
    if (motivo.trim().length < 3) return setError('Escribe el motivo (mínimo 3 letras).');
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/cancelar`, { motivo: motivo.trim() });
      alCambiar(r.envio);
      setAbierto(false);
      avisar(esConsolidado ? 'Consolidado deshecho: los paquetes volvieron a la bodega.' : 'Alerta descartada.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (!abierto) {
    return <button type="button" className="btn btn-fantasma text-rojo-700" onClick={() => setAbierto(true)}>{esConsolidado ? 'Deshacer este consolidado…' : 'Descartar esta alerta completa…'}</button>;
  }
  return (
    <div className="space-y-3 rounded-2xl border border-rojo/30 bg-rojo-100/50 p-4">
      <p className="text-sm font-semibold text-rojo-700">{esConsolidado ? 'Los paquetes vuelven a la bodega del cliente.' : 'Se descartan todos los paquetes de esta alerta.'}</p>
      <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-peligro btn-chico" onClick={() => void confirmar()}>{esConsolidado ? 'Deshacer' : 'Descartar'}</button>
        <button type="button" className="btn btn-suave btn-chico" onClick={() => setAbierto(false)}>Volver</button>
      </div>
    </div>
  );
}

function DeshacerCliente({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);

  async function deshacer() {
    if (!window.confirm('¿Deshacer este envío? Tus paquetes vuelven a la bodega y puedes armarlo de nuevo.')) return;
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/envios/${envio.id}/deshacer`, {});
      alCambiar(r.envio);
      avisar('Listo: tus paquetes volvieron a la bodega.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-fantasma text-rojo-700" onClick={() => void deshacer()}>Deshacer este envío</button>
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}

export default function DetalleEnvio({ personal }: { personal: boolean }) {
  const { id } = useParams();
  const { usuario } = useAuth();
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<{ envio: Envio }>(`/envios/${id}`).then((r) => r.envio), [id]);

  if (cargando && !datos) return <div className="contenedor py-8"><Cargando /></div>;
  if (error || !datos) return <div className="contenedor py-8"><ErrorCarga mensaje={error ?? 'No encontramos ese envío.'} reintentar={() => void recargar()} /></div>;

  const envio = datos;
  const alCambiar = (nuevo: Envio) => setDatos(nuevo);
  const esAlerta = envio.tipo === 'ALERTA';
  const alertaActiva = esAlerta && ESTADOS_ALERTA_ACTIVOS.includes(envio.estado);
  const consolidadoAbierto = !esAlerta && ESTADOS_CONSOLIDADO_ABIERTOS.includes(envio.estado);
  const sinPagosVivos = envio.pagos.every((p) => p.estado === 'RECHAZADO');
  const puedePagar = !esAlerta && envio.precio !== null && ['POR_PAGAR', 'POR_CONFIRMAR'].includes(envio.estado);
  const mostrarEntrega = !esAlerta && envio.estado !== 'CANCELADO';
  const hayEnBodega = alertaActiva && envio.paquetes.some((p) => p.recibido);
  const transportista = nombreTransportista(envio.transportista);
  const volver = personal ? (esAlerta ? '/panel/bodega' : '/panel/envios') : esAlerta ? '/cuenta/alertas' : '/cuenta/pedidos';

  return (
    <div className="contenedor py-6 sm:py-8">
      <Link to={volver} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-marino"><FiArrowLeft aria-hidden /> Volver</Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl">{tituloDe(envio)}</h1>
          <p className="mt-1 text-sm text-suave">
            {envio.paquetes.length} paquete(s)
            {!esAlerta && ` · ${transportista}`}
            {!esAlerta && envio.tienda !== 'Envío consolidado' && ` · ${envio.tienda}`}
            {personal && !envio.sinDueno && ` · ${envio.cliente.nombre}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {envio.sinDueno && <span className="insignia bg-rojo-100 text-rojo-700">Sin dueño</span>}
          <InsigniaEstado estado={envio.estado} />
        </div>
      </header>

      {!esAlerta && <div className="mb-6 rounded-tarjeta border border-linea bg-white p-4"><LineaEstado estado={envio.estado} /></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {personal && !envio.sinDueno && (
            <Seccion titulo="Cliente">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="text-lg font-bold">{envio.cliente.nombre}</p>
                  <p className="text-suave"><span className="codigo">{envio.cliente.codigo}</span> · Cédula {envio.cliente.cedulaEnmascarada}</p>
                </div>
                <a href={`tel:+${envio.cliente.telefono}`} className="btn btn-suave btn-chico"><FiPhone aria-hidden /> +{envio.cliente.telefono}</a>
              </div>
            </Seccion>
          )}
          {personal && envio.sinDueno && <Alerta tono="aviso">Este paquete está en bodega sin dueño. Asígnalo cuando sepas de quién es, o espera a que el cliente lo reclame con su alerta.</Alerta>}

          <Seccion
            titulo="Paquetes"
            derecha={esAlerta && envio.faltan > 0 ? <span className="insignia bg-oro-100 text-marino-900">Faltan {envio.faltan}</span> : esAlerta ? <span className="insignia bg-verde-100 text-verde">Todos llegaron</span> : undefined}
          >
            {personal ? <PaquetesPersonal envio={envio} alCambiar={alCambiar} /> : <PaquetesCliente paquetes={envio.paquetes} />}
            {!personal && hayEnBodega && (
              <div className="mt-4 rounded-2xl bg-oro-50 p-4">
                <p className="text-sm font-semibold text-marino-900">Tienes paquetes en bodega.</p>
                <p className="text-sm text-suave">Elige cuáles se envían juntos para que los pesemos y te demos el total.</p>
                <Link to="/cuenta/consolidar" className="btn btn-acento btn-chico mt-3">Consolidar envío</Link>
              </div>
            )}
          </Seccion>

          {personal && consolidadoAbierto && (
            <Seccion titulo="Peso y total">
              <CotizarConsolidado key={`${envio.id}-${envio.paquetes.length}`} envio={envio} alCambiar={alCambiar} />
            </Seccion>
          )}

          {personal && consolidadoAbierto && (
            <Seccion titulo="Agregar paquetes de la bodega del cliente">
              <AgregarDeBodega envio={envio} alCambiar={alCambiar} />
            </Seccion>
          )}

          {consolidadoAbierto && (
            <Seccion titulo="Modalidad de cobro">
              <SelectorModalidad envio={envio} alCambiar={alCambiar} />
              {personal && <div className="mt-4"><EditarDatosPersonal envio={envio} alCambiar={alCambiar} /></div>}
            </Seccion>
          )}

          {(puedePagar || envio.pagos.length > 0) && (
            <Seccion titulo={personal ? 'Pagos' : puedePagar ? 'Pagar este envío' : 'Tus pagos'}>
              {personal ? <PagosPersonal envio={envio} alCambiar={alCambiar} /> : puedePagar ? <PagoCliente envio={envio} alCambiar={alCambiar} /> : <ListaPagos pagos={envio.pagos} />}
              {!personal && puedePagar && envio.pagos.length > 0 && <div className="mt-5"><h3 className="mb-2 text-base">Tus pagos</h3><ListaPagos pagos={envio.pagos} /></div>}
            </Seccion>
          )}

          {mostrarEntrega && (
            <Seccion titulo="Datos de entrega en Venezuela">
              <EntregaForm key={`${envio.entrega.cedula}-${envio.estado}`} envio={envio} alCambiar={alCambiar} bloqueado={['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado)} />
            </Seccion>
          )}

          {!personal && (envio.estado === 'DESPACHADO' || envio.estado === 'CERRADO') && envio.guia.numero && (
            <Seccion titulo="Tu guía de Venezuela">
              <p className="text-sm text-suave">{transportista}</p>
              <p className="codigo text-2xl">{envio.guia.numero}</p>
              {envio.guia.tieneFoto && <div className="mt-4"><ImagenPrivada ruta={envio.guia.fotoRuta} alt="Foto de la guía" className="max-h-80 w-full object-contain bg-papel sm:w-auto" /></div>}
              <a className="btn btn-primario mt-4" target="_blank" rel="noopener noreferrer" href={enlaceRastreo(envio.transportista === 'ZOOM' ? 'https://zoom.red/tracking-de-envios-personas/' : 'https://mrwve.com', null, envio.guia.numero)}>Rastrear en {transportista}</a>
            </Seccion>
          )}

          {personal && ['PAGADO', 'DESPACHADO', 'CERRADO'].includes(envio.estado) && (
            <Seccion titulo="Despacho"><DespachoForm envio={envio} alCambiar={alCambiar} /></Seccion>
          )}

          {!personal && consolidadoAbierto && sinPagosVivos && <DeshacerCliente envio={envio} alCambiar={alCambiar} />}

          {personal && (
            <div className="space-y-3">
              {usuario?.rol === 'ADMIN' && !esAlerta && !ESTADOS_CERRADOS.includes(envio.estado) && <AjusteAdmin envio={envio} alCambiar={alCambiar} />}
              <Historial envioId={envio.id} />
              {(alertaActiva || (consolidadoAbierto && sinPagosVivos)) && <DescartarEnvio envio={envio} alCambiar={alCambiar} />}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {!esAlerta && <PrecioCaja envio={envio} />}
          <div className="rounded-2xl border border-linea bg-white p-4 text-sm">
            <p className="flex justify-between"><span className="text-suave">Valor declarado</span><b>{formatearUsd(envio.valorDeclaradoCentavos)}</b></p>
            {!esAlerta && <p className="mt-1 flex justify-between"><span className="text-suave">Transportista</span><b>{transportista}</b></p>}
            {esAlerta && <p className="mt-2 text-suave">El precio se calcula cuando los paquetes se consolidan y se pesan juntos.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
