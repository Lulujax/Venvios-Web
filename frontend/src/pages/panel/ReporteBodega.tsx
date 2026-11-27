import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiFileText, FiX } from 'react-icons/fi';
import { BuscadorCliente } from '../../components/BuscadorCliente';
import { Alerta, Cargando, ErrorCarga } from '../../components/ui';
import { ambitoActual, CABECERA_AMBITO } from '../../lib/ambito';
import { api, mensajeDeError } from '../../lib/api';
import { formatearFecha, formatearKg } from '../../lib/formato';
import type {
  ClienteFiltroVista,
  EtapaInventario,
  OrigenPaqueteEstado,
  PrealertaOrigenVista,
  ReporteEstadoCuenta,
  ReporteInventario,
  ReportePrealertasPendientes,
  RespuestaReporte,
  TipoReporte,
  Usuario,
} from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

type FormatoReporte = 'pdf' | 'xlsx';

const TIPOS: Array<{ valor: TipoReporte; titulo: string; pregunta: string }> = [
  {
    valor: 'inventario',
    titulo: 'Inventario de bodega',
    pregunta: 'Qué hay físicamente en la oficina, agrupado por cliente y etapa.',
  },
  {
    valor: 'prealertas-pendientes',
    titulo: 'Prealertas pendientes',
    pregunta: 'Qué prealertas tienen paquetes por llegar, cuántos llegaron y cuáles faltan.',
  },
  {
    valor: 'estado-de-cuenta',
    titulo: 'Estado de cuenta',
    pregunta: 'Qué le falta por llegar, qué tiene en bodega y qué está consolidado de un cliente.',
  },
];

const ETIQUETAS_ETAPA_INVENTARIO: Record<EtapaInventario, string> = {
  EN_BODEGA: 'En bodega',
  SIN_DUENO: 'Sin dueño',
  ESPERANDO_PAGO: 'Esperando pago',
  LISTO_PARA_SALIR: 'Listo para salir',
};

const ATAJOS_PERIODO = [30, 60, 90] as const;

function esTipoReporte(valor: string | null): valor is TipoReporte {
  return valor === 'inventario' || valor === 'prealertas-pendientes' || valor === 'estado-de-cuenta';
}

function esEtapaInventario(valor: string | null): valor is EtapaInventario {
  return valor === 'EN_BODEGA' || valor === 'SIN_DUENO' || valor === 'ESPERANDO_PAGO' || valor === 'LISTO_PARA_SALIR';
}

function fechaUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function rangoUltimosDias(dias: number, ahora: Date = new Date()): { desde: string; hasta: string } {
  const hasta = fechaUtc(ahora);
  const inicio = new Date(ahora.getTime() - dias * 86_400_000);
  return { desde: fechaUtc(inicio), hasta };
}

function nombreDesdeCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null;
  const coincidencia = /filename="?([^";]+)"?/i.exec(cabecera);
  return coincidencia ? coincidencia[1]! : null;
}

function textoOrigen(estado: OrigenPaqueteEstado, origen: PrealertaOrigenVista | null): string {
  if (estado === 'PREALERTA' && origen) return `${origen.tienda} · ${formatearFecha(origen.fecha)}`;
  if (estado === 'SIN_PREALERTA') return 'Sin prealerta';
  return 'Sin registro de prealerta';
}

function Chip({ etiqueta, alQuitar }: { etiqueta: string; alQuitar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-marino-50 py-1 pl-3 pr-1.5 text-sm text-marino-900">
      {etiqueta}
      <button type="button" className="rounded-full p-0.5 hover:bg-marino-100" onClick={alQuitar} aria-label={`Quitar filtro: ${etiqueta}`}>
        <FiX aria-hidden />
      </button>
    </span>
  );
}

function TarjetaResumen({ etiqueta, valor, acento = false }: { etiqueta: string; valor: string | number; acento?: boolean }) {
  return (
    <div className="rounded-2xl border border-linea bg-papel px-3.5 py-3">
      <p className="text-xs font-semibold text-suave">{etiqueta}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${acento ? 'text-oro-600' : 'text-marino'}`}>{valor}</p>
    </div>
  );
}

function ResumenInventarioVista({ reporte }: { reporte: ReporteInventario }) {
  const { resumen } = reporte;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <TarjetaResumen etiqueta="Total paquetes" valor={resumen.totalPaquetes} />
        <TarjetaResumen etiqueta="Peso total" valor={formatearKg(resumen.pesoTotalKg)} />
        <TarjetaResumen etiqueta="Sin avisar" valor={resumen.sinAvisar} acento={resumen.sinAvisar > 0} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <TarjetaResumen etiqueta="En bodega" valor={resumen.porEtapa.EN_BODEGA} />
        <TarjetaResumen etiqueta="Sin dueño" valor={resumen.porEtapa.SIN_DUENO} />
        <TarjetaResumen etiqueta="Esperando pago" valor={resumen.porEtapa.ESPERANDO_PAGO} />
        <TarjetaResumen etiqueta="Listo para salir" valor={resumen.porEtapa.LISTO_PARA_SALIR} />
      </div>
      {reporte.clientes.length === 0 ? (
        <Alerta tono="info">Sin resultados: no hay paquetes que coincidan con los filtros elegidos.</Alerta>
      ) : (
        <div className="space-y-3">
          {reporte.clientes.map((grupo) => (
            <div key={grupo.cliente.id} className="rounded-2xl border border-linea bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-2">
                <p className="text-sm font-bold text-marino-900">
                  {grupo.cliente.nombre}
                  {grupo.cliente.codigo ? <span className="codigo ml-2 text-suave">{grupo.cliente.codigo}</span> : null}
                </p>
                <p className="text-xs font-semibold text-suave">
                  {grupo.totalPaquetes} {grupo.totalPaquetes === 1 ? 'paquete' : 'paquetes'} · {formatearKg(grupo.pesoTotalKg)}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-linea text-xs">
                {grupo.items.map((item) => (
                  <li key={item.paqueteId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <div>
                      <span className="codigo text-marino-900">{item.tracking}</span>
                      <span className="ml-2 font-semibold text-marino">{item.etiquetaEtapa}</span>
                      <span className="ml-2 text-suave">· {textoOrigen(item.origenEstado, item.prealertaOrigen)}</span>
                    </div>
                    <span className="text-suave">
                      {formatearKg(item.pesoKg)} · {item.diasEnBodega === null ? '—' : `${item.diasEnBodega} d`}
                      {item.etapa !== 'SIN_DUENO' ? (item.avisado ? ' · Avisado' : ' · Sin avisar') : ''}
                      {item.tieneFoto ? ' · Con foto' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenPrealertasVista({ reporte }: { reporte: ReportePrealertasPendientes }) {
  const { resumen } = reporte;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <TarjetaResumen etiqueta="Prealertas pendientes" valor={resumen.totalPrealertas} />
        <TarjetaResumen etiqueta="Paquetes por llegar" valor={resumen.totalPaquetesPorLlegar} />
        <TarjetaResumen etiqueta="Clientes" valor={resumen.totalClientes} />
      </div>
      {resumen.sinRegistroPrealerta > 0 && (
        <Alerta tono="aviso">
          Hay <b>{resumen.sinRegistroPrealerta}</b> {resumen.sinRegistroPrealerta === 1 ? 'paquete consolidado' : 'paquetes consolidados'} antes de este cambio sin registro de prealerta.
        </Alerta>
      )}
      {reporte.clientes.length === 0 ? (
        <Alerta tono="info">Sin resultados: no hay prealertas pendientes con los filtros elegidos.</Alerta>
      ) : (
        <div className="space-y-3">
          {reporte.clientes.map((grupo) => (
            <div key={grupo.cliente.id} className="rounded-2xl border border-linea bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-2">
                <p className="text-sm font-bold text-marino-900">
                  {grupo.cliente.nombre} <span className="codigo ml-2 text-suave">{grupo.cliente.codigo}</span>
                </p>
                <p className="text-xs font-semibold text-suave">{grupo.totalPorLlegar} por llegar</p>
              </div>
              <ul className="mt-2 divide-y divide-linea text-xs">
                {grupo.prealertas.map((p) => (
                  <li key={p.envioId} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-marino-900">
                        {p.tienda} · {formatearFecha(p.fechaAviso)} ({p.diasDesdeAviso} d)
                      </span>
                      <span className="font-bold text-marino">
                        Llegaron {p.llegaron} de {p.total}
                      </span>
                    </div>
                    <p className="mt-1 text-suave">
                      Faltan: <span className="codigo text-marino-900">{p.trackingsFaltantes.join(', ')}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenEstadoCuentaVista({ reporte }: { reporte: ReporteEstadoCuenta }) {
  const { porEtapa, incluyeEntregados } = reporte.resumen;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <TarjetaResumen etiqueta="Por llegar" valor={porEtapa.POR_LLEGAR} />
        <TarjetaResumen etiqueta="En bodega" valor={porEtapa.EN_BODEGA} />
        <TarjetaResumen etiqueta="Esperando pago" valor={porEtapa.ESPERANDO_PAGO} />
        <TarjetaResumen etiqueta="Listo para salir" valor={porEtapa.LISTO_PARA_SALIR} />
        <TarjetaResumen etiqueta="En ruta" valor={porEtapa.EN_RUTA} />
        <TarjetaResumen etiqueta="Entregado" valor={porEtapa.ENTREGADO} />
      </div>

      {!incluyeEntregados && (
        <Alerta tono="info">
          No elegiste un periodo, así que no se muestran envíos entregados. Todo su historial está en{' '}
          <Link to={`/panel/envios?estado=TODOS&q=${encodeURIComponent(reporte.cliente.codigo)}`} className="font-bold underline">
            Envíos
          </Link>
          .
        </Alerta>
      )}

      {reporte.resumen.totalPaquetes === 0 && (
        <Alerta tono="info">Sin resultados: este cliente no tiene movimientos dentro de los criterios aplicados.</Alerta>
      )}

      {reporte.prealertas.length > 0 && (
        <div className="rounded-2xl border border-linea bg-white p-3.5">
          <h3 className="text-sm font-bold text-marino-900">Prealertas pendientes</h3>
          <ul className="mt-2 divide-y divide-linea text-xs">
            {reporte.prealertas.map((p) => (
              <li key={p.envioId} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {p.tienda} · {formatearFecha(p.fechaAviso)} ({p.diasDesdeAviso} d)
                  </span>
                  <span className="font-bold text-marino">
                    Llegaron {p.llegaron} de {p.total}
                  </span>
                </div>
                <p className="mt-1 text-suave">
                  Faltan: <span className="codigo text-marino-900">{p.trackingsFaltantes.join(', ')}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reporte.enBodega.length > 0 && (
        <div className="rounded-2xl border border-linea bg-white p-3.5">
          <h3 className="text-sm font-bold text-marino-900">En bodega</h3>
          <ul className="mt-2 divide-y divide-linea text-xs">
            {reporte.enBodega.map((item) => (
              <li key={item.paqueteId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  <span className="codigo text-marino-900">{item.tracking}</span>
                  <span className="ml-2 text-suave">· {textoOrigen(item.origenEstado, item.prealertaOrigen)}</span>
                </span>
                <span className="text-suave">
                  {formatearKg(item.pesoKg)} · {item.diasEnBodega === null ? '—' : `${item.diasEnBodega} d`} · {item.avisado ? 'Avisado' : 'Sin avisar'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reporte.consolidados.length > 0 && (
        <div className="rounded-2xl border border-linea bg-white p-3.5">
          <h3 className="text-sm font-bold text-marino-900">Consolidados sin entregar</h3>
          <ul className="mt-2 space-y-2 text-xs">
            {reporte.consolidados.map((c) => (
              <li key={c.envioId} className="rounded-xl bg-papel p-2.5">
                <p className="font-bold text-marino-900">
                  Consolidación {String(c.numero).padStart(6, '0')} · {c.etiquetaEtapa} ({c.etiquetaEstado}) · {c.transportista}
                  {c.pesoTotalKg !== null ? ` · ${formatearKg(c.pesoTotalKg)}` : ''}
                </p>
                <p className="codigo mt-1 text-suave">{c.paquetes.map((p) => p.tracking).join(', ')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {incluyeEntregados && reporte.entregados.length > 0 && (
        <div className="rounded-2xl border border-linea bg-white p-3.5">
          <h3 className="text-sm font-bold text-marino-900">Entregados en el periodo</h3>
          <ul className="mt-2 space-y-2 text-xs">
            {reporte.entregados.map((c) => (
              <li key={c.envioId} className="rounded-xl bg-papel p-2.5">
                <p className="font-bold text-marino-900">
                  Consolidación {String(c.numero).padStart(6, '0')} · Entregado {c.entregadoEn ? formatearFecha(c.entregadoEn) : ''} · {c.transportista}
                </p>
                <p className="codigo mt-1 text-suave">{c.paquetes.map((p) => p.tracking).join(', ')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ReporteBodega() {
  const [params, setParams] = useSearchParams();
  const tipoCrudo = params.get('tipo');
  const tipo: TipoReporte = esTipoReporte(tipoCrudo) ? tipoCrudo : 'inventario';
  const clienteId = params.get('clienteId') ?? '';
  const etapaCruda = params.get('etapa');
  const etapa: EtapaInventario | '' = tipo === 'inventario' && esEtapaInventario(etapaCruda) ? etapaCruda : '';
  const minDias = tipo === 'inventario' ? Number.parseInt(params.get('minDias') ?? '0', 10) || 0 : 0;
  const soloSinAvisar = tipo === 'inventario' && params.get('soloSinAvisar') === '1';
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';

  const [clienteRecordado, setClienteRecordado] = useState<ClienteFiltroVista | null>(null);
  const [formatoDescargando, setFormatoDescargando] = useState<FormatoReporte | null>(null);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const rangoInvertido = Boolean(desde && hasta && desde > hasta);
  const faltaClienteObligatorio = tipo === 'estado-de-cuenta' && !clienteId;

  const consultaApi = new URLSearchParams();
  if (clienteId) consultaApi.set('clienteId', clienteId);
  if (tipo === 'inventario') {
    if (etapa) consultaApi.set('etapa', etapa);
    if (minDias > 0) consultaApi.set('minDias', String(minDias));
    if (soloSinAvisar) consultaApi.set('soloSinAvisar', '1');
  }
  if (desde) consultaApi.set('desde', desde);
  if (hasta) consultaApi.set('hasta', hasta);
  const consultaCadena = consultaApi.toString();

  const puedeConsultar = !rangoInvertido && !faltaClienteObligatorio;
  const { datos, cargando, error, recargar } = useCarga<RespuestaReporte | null>(
    () => (puedeConsultar ? api.get<RespuestaReporte>(`/staff/reportes/${tipo}${consultaCadena ? `?${consultaCadena}` : ''}`) : Promise.resolve(null)),
    [tipo, consultaCadena, puedeConsultar],
  );

  const clienteSeleccionado: ClienteFiltroVista | null =
    clienteId && clienteRecordado?.id === clienteId
      ? clienteRecordado
      : clienteId && datos?.clienteFiltro?.id === clienteId
        ? datos.clienteFiltro
        : null;

  function actualizarUrl(mutar: (nuevos: URLSearchParams) => void) {
    const nuevos = new URLSearchParams(params);
    mutar(nuevos);
    setParams(nuevos, { replace: true });
  }

  function cambiarTipo(nuevoTipo: TipoReporte) {
    actualizarUrl((nuevos) => {
      nuevos.set('tipo', nuevoTipo);
      if (nuevoTipo !== 'inventario') {
        nuevos.delete('etapa');
        nuevos.delete('minDias');
        nuevos.delete('soloSinAvisar');
      }
    });
    setErrorReporte(null);
  }

  function cambiarParametro(clave: string, valor: string) {
    actualizarUrl((nuevos) => {
      if (!nuevos.get('tipo')) nuevos.set('tipo', tipo);
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    });
  }

  function elegirCliente(elegido: Usuario | null) {
    setClienteRecordado(elegido ? { id: elegido.id, nombre: elegido.nombre, codigo: elegido.codigo } : null);
    cambiarParametro('clienteId', elegido ? elegido.id : '');
  }

  function aplicarAtajoDias(dias: number) {
    const rango = rangoUltimosDias(dias);
    actualizarUrl((nuevos) => {
      if (!nuevos.get('tipo')) nuevos.set('tipo', tipo);
      nuevos.set('desde', rango.desde);
      nuevos.set('hasta', rango.hasta);
    });
  }

  function quitarPeriodo() {
    actualizarUrl((nuevos) => {
      nuevos.delete('desde');
      nuevos.delete('hasta');
    });
  }

  function limpiarTodo() {
    setClienteRecordado(null);
    setErrorReporte(null);
    setParams({ tipo }, { replace: true });
  }

  const etiquetaClienteChip = clienteSeleccionado
    ? `Cliente: ${clienteSeleccionado.nombre} (${clienteSeleccionado.codigo})`
    : 'Cliente seleccionado';

  const etiquetaPeriodoChip =
    desde && hasta ? `Periodo: ${desde} a ${hasta}` : desde ? `Desde: ${desde}` : hasta ? `Hasta: ${hasta}` : '';

  const filtrosActivos = [
    clienteId ? { etiqueta: etiquetaClienteChip, alQuitar: () => elegirCliente(null) } : null,
    etapa ? { etiqueta: `Etapa: ${ETIQUETAS_ETAPA_INVENTARIO[etapa]}`, alQuitar: () => cambiarParametro('etapa', '') } : null,
    minDias > 0 ? { etiqueta: `${minDias} días o más`, alQuitar: () => cambiarParametro('minDias', '') } : null,
    soloSinAvisar ? { etiqueta: 'Solo sin avisar', alQuitar: () => cambiarParametro('soloSinAvisar', '') } : null,
    etiquetaPeriodoChip ? { etiqueta: etiquetaPeriodoChip, alQuitar: quitarPeriodo } : null,
  ].filter((f): f is { etiqueta: string; alQuitar: () => void } => f !== null);

  async function descargar(formato: FormatoReporte) {
    if (rangoInvertido || faltaClienteObligatorio) return;
    setFormatoDescargando(formato);
    setErrorReporte(null);
    try {
      const ruta = `/api/staff/reportes/${tipo}.${formato}${consultaCadena ? `?${consultaCadena}` : ''}`;
      const respuesta = await fetch(ruta, {
        credentials: 'same-origin',
        headers: { [CABECERA_AMBITO]: ambitoActual() },
      });
      if (!respuesta.ok) {
        let mensajeServidor: string | null = null;
        try {
          const cuerpo = (await respuesta.json()) as { error?: { mensaje?: string } };
          mensajeServidor = cuerpo.error?.mensaje ?? null;
        } catch {
          mensajeServidor = null;
        }
        throw new Error(
          respuesta.status === 401
            ? 'Tu sesión venció. Vuelve a entrar y prueba de nuevo.'
            : (mensajeServidor ?? 'No pudimos generar el reporte. Intenta de nuevo.'),
        );
      }
      const blob = await respuesta.blob();
      const fechaHoy = fechaUtc(new Date());
      const casillero = clienteSeleccionado?.codigo ?? 'cliente';
      const nombrePorDefecto =
        tipo === 'estado-de-cuenta' ? `estado-de-cuenta-${casillero}-${fechaHoy}.${formato}` : `${tipo}-${fechaHoy}.${formato}`;
      const nombre = nombreDesdeCabecera(respuesta.headers.get('content-disposition')) ?? nombrePorDefecto;
      const direccion = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = direccion;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(direccion), 1000);
    } catch (falla) {
      setErrorReporte(falla instanceof Error ? falla.message : mensajeDeError(falla));
    } finally {
      setFormatoDescargando(null);
    }
  }

  const descargasBloqueadas = formatoDescargando !== null || rangoInvertido || faltaClienteObligatorio;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <Link to="/panel/bodega" className="btn btn-suave btn-chico mb-4">
        <FiArrowLeft aria-hidden /> Volver a bodega
      </Link>

      <h1 className="text-3xl">Generar reporte</h1>
      <p className="mt-1 text-suave">Primero elige qué pregunta quieres responder, luego ajusta los filtros y descarga en PDF o Excel.</p>

      <section className="mt-5" aria-labelledby="titulo-tipo-reporte">
        <h2 id="titulo-tipo-reporte" className="etiqueta">1. Tipo de reporte</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIPOS.map((opcion) => {
            const activo = tipo === opcion.valor;
            return (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => cambiarTipo(opcion.valor)}
                className={`rounded-2xl border p-4 text-left transition ${activo ? 'border-marino bg-marino-50 ring-2 ring-marino/20' : 'border-linea bg-white hover:border-marino/40'}`}
              >
                <p className="font-display text-base font-bold text-marino-900">{opcion.titulo}</p>
                <p className="mt-1 text-xs text-suave">{opcion.pregunta}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="tarjeta mt-5 space-y-5 p-5">
        {filtrosActivos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-linea pb-4">
            {filtrosActivos.map((f) => (
              <Chip key={f.etiqueta} etiqueta={f.etiqueta} alQuitar={f.alQuitar} />
            ))}
            <button type="button" className="text-sm font-bold text-suave hover:text-marino hover:underline" onClick={limpiarTodo}>
              Limpiar todo
            </button>
          </div>
        )}

        <div>
          <p className="etiqueta">
            {tipo === 'estado-de-cuenta' ? 'Cliente (obligatorio)' : 'Cliente (opcional, déjalo vacío para ver todos)'}
          </p>
          <BuscadorCliente cliente={clienteSeleccionado} onElegir={elegirCliente} etiqueta="Buscar cliente" />
          {tipo === 'estado-de-cuenta' && clienteSeleccionado && (
            <Link
              to={`/panel/envios?estado=TODOS&q=${encodeURIComponent(clienteSeleccionado.codigo)}`}
              className="mt-2 inline-block text-sm font-bold text-marino hover:underline"
            >
              Ver su historial completo en Envíos
            </Link>
          )}
        </div>

        {tipo === 'inventario' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="etapa-reporte" className="etiqueta">Etapa</label>
                <select id="etapa-reporte" className="campo" value={etapa} onChange={(e) => cambiarParametro('etapa', e.target.value)}>
                  <option value="">Todas las etapas en bodega</option>
                  <option value="EN_BODEGA">En bodega</option>
                  <option value="SIN_DUENO">Sin dueño</option>
                  <option value="ESPERANDO_PAGO">Esperando pago</option>
                  <option value="LISTO_PARA_SALIR">Listo para salir</option>
                </select>
              </div>
              <div>
                <label htmlFor="dias-reporte" className="etiqueta">Días en bodega</label>
                <select
                  id="dias-reporte"
                  className="campo"
                  value={minDias}
                  onChange={(e) => cambiarParametro('minDias', e.target.value === '0' ? '' : e.target.value)}
                >
                  <option value={0}>Cualquiera</option>
                  <option value={7}>7 o más</option>
                  <option value={15}>15 o más</option>
                  <option value={30}>30 o más</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={soloSinAvisar}
                onChange={(e) => cambiarParametro('soloSinAvisar', e.target.checked ? '1' : '')}
              />
              Solo sin avisar
            </label>
          </div>
        )}

        <div className="space-y-3 border-t border-linea pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="etiqueta mb-0">Periodo (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {ATAJOS_PERIODO.map((dias) => (
                <button key={dias} type="button" className="btn btn-suave btn-chico" onClick={() => aplicarAtajoDias(dias)}>
                  Últimos {dias} días
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="periodo-desde" className="etiqueta">Desde</label>
              <input
                id="periodo-desde"
                type="date"
                className="campo"
                value={desde}
                onChange={(e) => cambiarParametro('desde', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="periodo-hasta" className="etiqueta">Hasta</label>
              <input
                id="periodo-hasta"
                type="date"
                className="campo"
                value={hasta}
                onChange={(e) => cambiarParametro('hasta', e.target.value)}
              />
            </div>
          </div>
          {rangoInvertido && <Alerta tono="error">La fecha «Desde» no puede ser posterior a «Hasta». Corrige el periodo para ver y descargar.</Alerta>}
        </div>

        {faltaClienteObligatorio && (
          <Alerta tono="aviso">Elige un cliente para ver su estado de cuenta y activar los botones de descarga.</Alerta>
        )}

        {puedeConsultar && (
          <div className="space-y-3 border-t border-linea pt-4">
            <h2 className="text-lg font-bold text-marino-900">Resumen previo</h2>
            {cargando && <Cargando lineas={2} />}
            {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
            {!cargando && !error && datos && (
              <>
                {datos.reporte.tipo === 'inventario' && <ResumenInventarioVista reporte={datos.reporte} />}
                {datos.reporte.tipo === 'prealertas-pendientes' && <ResumenPrealertasVista reporte={datos.reporte} />}
                {datos.reporte.tipo === 'estado-de-cuenta' && <ResumenEstadoCuentaVista reporte={datos.reporte} />}
              </>
            )}
          </div>
        )}

        {errorReporte && <Alerta tono="error">{errorReporte}</Alerta>}

        <div className="grid gap-3 border-t border-linea pt-4 sm:grid-cols-2">
          <button type="button" className="btn btn-primario" disabled={descargasBloqueadas} onClick={() => void descargar('pdf')}>
            <FiFileText aria-hidden /> {formatoDescargando === 'pdf' ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
          <button type="button" className="btn btn-suave" disabled={descargasBloqueadas} onClick={() => void descargar('xlsx')}>
            <FiDownload aria-hidden /> {formatoDescargando === 'xlsx' ? 'Generando Excel…' : 'Exportar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
