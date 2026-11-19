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
import { Alerta, Campo, Cargando, ErrorCarga, ImagenPrivada, InsigniaEstado, Seccion, useAviso } from '../components/ui';
import { api, mensajeDeError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD, aNumero, formatearUsd, nombreTransportista } from '../lib/formato';
import type { Envio, Modalidad, Usuario } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';
import { enlaceRastreo } from '../lib/whatsapp';

const ESTADOS_EDITABLES = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'];

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

function BuscarClienteAsignar({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function buscar(texto: string) {
    setConsulta(texto);
    if (texto.trim().length < 3) return setResultados([]);
    try {
      setResultados((await api.get<{ clientes: Usuario[] }>(`/staff/clientes?q=${encodeURIComponent(texto)}`)).clientes);
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  async function asignar(cliente: Usuario) {
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/asignar-cliente`, { clienteId: cliente.id });
      alCambiar(r.envio);
      avisar(`Asignado a ${cliente.nombre}.`);
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  return (
    <div className="space-y-3">
      <Alerta tono="aviso">Este paquete llegó sin prealerta. Busca al cliente por nombre, teléfono o cédula para asignárselo.</Alerta>
      <Campo etiqueta="Buscar cliente" value={consulta} onChange={(e) => void buscar(e.target.value)} />
      {error && <Alerta tono="error">{error}</Alerta>}
      <ul className="space-y-2">
        {resultados.map((cliente) => (
          <li key={cliente.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linea px-4 py-3 text-sm">
            <span><b>{cliente.nombre}</b> · {cliente.cedulaEnmascarada}</span>
            <button type="button" className="btn btn-primario btn-chico" onClick={() => void asignar(cliente)}>Asignar</button>
          </li>
        ))}
      </ul>
    </div>
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

export default function DetalleEnvio({ personal }: { personal: boolean }) {
  const { id } = useParams();
  const { usuario } = useAuth();
  const avisar = useAviso();
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<{ envio: Envio }>(`/envios/${id}`).then((r) => r.envio), [id]);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');

  const volver = personal ? '/panel/envios' : '/cuenta';

  if (cargando && !datos) return <div className="contenedor py-8"><Cargando /></div>;
  if (error || !datos) return <div className="contenedor py-8"><ErrorCarga mensaje={error ?? 'No encontramos ese envío.'} reintentar={() => void recargar()} /></div>;

  const envio = datos;
  const alCambiar = (nuevo: Envio) => setDatos(nuevo);
  const editable = ESTADOS_EDITABLES.includes(envio.estado);
  const puedePagar = envio.precio !== null && ['RECIBIDO_COMPLETO', 'POR_CONFIRMAR'].includes(envio.estado);
  const mostrarEntrega = ['POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO'].includes(envio.estado);
  const puedeCerrarRecepcion = ['RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'].includes(envio.estado) && envio.faltan > 0 && envio.paquetes.some((p) => p.recibido);
  const sinAsignar = personal && envio.tienda === 'Sin prealerta' && envio.cliente.nombre === 'Sin asignar';
  const transportista = nombreTransportista(envio.transportista);

  async function cerrarRecepcion() {
    setErrorAccion(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/envios/${envio.id}/cerrar-recepcion`);
      alCambiar(r.envio);
      avisar('Listo: este envío quedó con los paquetes que ya llegaron. Los demás pasaron a un envío nuevo.');
    } catch (falla) {
      setErrorAccion(mensajeDeError(falla));
    }
  }

  async function cancelar() {
    setErrorAccion(null);
    try {
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/cancelar`, { motivo: motivoCancelar });
      alCambiar(r.envio);
      setCancelando(false);
      avisar('Envío cancelado.');
    } catch (falla) {
      setErrorAccion(mensajeDeError(falla));
    }
  }

  return (
    <div className="contenedor py-6 sm:py-8">
      <Link to={volver} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-marino"><FiArrowLeft aria-hidden /> Volver</Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{envio.tienda === 'Sin prealerta' ? 'Paquete sin prealerta' : `Envío de ${envio.tienda}`}</h1>
          <p className="mt-1 text-sm text-suave">{envio.paquetes.length} paquete(s) · {transportista}{personal ? ` · ${envio.cliente.nombre}` : ''}</p>
        </div>
        <InsigniaEstado estado={envio.estado} />
      </header>

      <div className="mb-6 rounded-tarjeta border border-linea bg-white p-4"><LineaEstado estado={envio.estado} /></div>

      {errorAccion && <Alerta tono="error" className="mb-4">{errorAccion}</Alerta>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {personal && (
            <Seccion titulo="Cliente">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="text-lg font-bold">{envio.cliente.nombre}</p>
                  <p className="text-suave">Cédula {envio.cliente.cedulaEnmascarada}</p>
                </div>
                <a href={`tel:+${envio.cliente.telefono}`} className="btn btn-suave btn-chico"><FiPhone aria-hidden /> +{envio.cliente.telefono}</a>
              </div>
              {sinAsignar && <div className="mt-4"><BuscarClienteAsignar envio={envio} alCambiar={alCambiar} /></div>}
            </Seccion>
          )}

          <Seccion titulo="Paquetes" derecha={envio.faltan > 0 ? <span className="insignia bg-oro-100 text-marino-900">Faltan {envio.faltan}</span> : <span className="insignia bg-verde-100 text-verde">Todos llegaron</span>}>
            {personal ? <PaquetesPersonal envio={envio} alCambiar={alCambiar} /> : <PaquetesCliente paquetes={envio.paquetes} />}
            {puedeCerrarRecepcion && (
              <div className="mt-4 rounded-2xl bg-oro-50 p-4">
                <p className="text-sm font-semibold text-marino-900">¿No quieres esperar los {envio.faltan} paquete(s) que faltan?</p>
                <p className="text-sm text-suave">Cierra este envío con lo que ya llegó y págalo ya. Los que faltan pasan a un envío nuevo.</p>
                <button type="button" className="btn btn-acento btn-chico mt-3" onClick={() => void cerrarRecepcion()}>Pagar con lo que ya llegó</button>
              </div>
            )}
          </Seccion>

          {editable && (
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

          {personal && (
            <div className="space-y-3">
              {usuario?.rol === 'ADMIN' && !['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado) && <AjusteAdmin envio={envio} alCambiar={alCambiar} />}
              <Historial envioId={envio.id} />
              {!['DESPACHADO', 'CERRADO', 'CANCELADO'].includes(envio.estado) && (
                cancelando ? (
                  <div className="space-y-3 rounded-2xl border border-rojo/30 bg-rojo-100/50 p-4">
                    <Campo etiqueta="Motivo de la cancelación" value={motivoCancelar} onChange={(e) => setMotivoCancelar(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-peligro btn-chico" onClick={() => void cancelar()}>Cancelar envío</button>
                      <button type="button" className="btn btn-suave btn-chico" onClick={() => setCancelando(false)}>Volver</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-fantasma text-rojo-700" onClick={() => setCancelando(true)}>Cancelar este envío…</button>
                )
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PrecioCaja envio={envio} />
          <div className="rounded-2xl border border-linea bg-white p-4 text-sm">
            <p className="flex justify-between"><span className="text-suave">Valor declarado</span><b>{formatearUsd(envio.valorDeclaradoCentavos)}</b></p>
            <p className="mt-1 flex justify-between"><span className="text-suave">Transportista</span><b>{transportista}</b></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
