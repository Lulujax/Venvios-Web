import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBell, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { PieTandas, useTandas } from '../../components/Tandas';
import { Alerta, Cargando, ErrorCarga, Vacio, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { construirAlertas, filtrarAlertas, type EstadoAlerta, type FilaAlerta } from '../../lib/cuenta';
import { formatearFecha } from '../../lib/formato';

const TONO: Record<EstadoAlerta, string> = {
  PENDIENTE: 'bg-oro-100 text-oro-600',
  ATENDIDA: 'bg-verde-100 text-verde',
};

const TEXTO: Record<EstadoAlerta, string> = {
  PENDIENTE: 'Pendiente',
  ATENDIDA: 'Atendida',
};

export function Alertas() {
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const avisar = useAviso();
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<EstadoAlerta | 'TODOS'>('TODOS');
  const todas = datos ? construirAlertas(datos) : [];
  const filas = filtrarAlertas(todas, texto, estado);
  const tandas = useTandas(filas);

  async function eliminar(fila: FilaAlerta) {
    if (!window.confirm(`¿Eliminar la alerta del tracking ${fila.tracking}?`)) return;
    setErrorEliminar(null);
    try {
      await api.post(`/paquetes/${fila.paqueteId}/eliminar-alerta`);
      avisar('Alerta eliminada.');
      await recargar();
    } catch (falla) {
      setErrorEliminar(mensajeDeError(falla));
    }
  }

  return (
    <>
      <EncabezadoCuenta
        titulo="Alertas"
        subtitulo="Los paquetes que nos avisaste. Quedan «Pendiente» hasta que llegan a nuestra oficina."
        derecha={<Link to="/cuenta/nuevo" className="btn btn-acento"><FiBell aria-hidden /> Crear alerta</Link>}
      />
      <ContenidoCuenta>
        <div className="tarjeta p-5 sm:p-6">
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="buscar-tracking" className="etiqueta">Tracking</label>
              <input id="buscar-tracking" className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por tracking" />
            </div>
            <div>
              <label htmlFor="filtro-estado" className="etiqueta">Estado</label>
              <select id="filtro-estado" className="campo" value={estado} onChange={(e) => setEstado(e.target.value as EstadoAlerta | 'TODOS')}>
                <option value="TODOS">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="ATENDIDA">Atendida</option>
              </select>
            </div>
          </div>

          {errorEliminar && <Alerta tono="error" className="mb-4">{errorEliminar}</Alerta>}
          {cargando && <Cargando />}
          {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
          {datos && todas.length === 0 && <Vacio titulo="Aún no tienes alertas" texto="Registra el tracking de tus compras y te avisamos cuando lleguen a Cúcuta." accion={<Link to="/cuenta/nuevo" className="btn btn-primario">Crear mi primera alerta</Link>} />}
          {datos && todas.length > 0 && filas.length === 0 && <Vacio titulo="Sin resultados" texto="Prueba con otro tracking o cambia el estado." />}

          {filas.length > 0 && (
            <div>
              <div className="hidden grid-cols-[1fr_1fr_1.6fr_1fr_28px] gap-4 border-b border-linea pb-3 pl-3 pr-[3.25rem] text-xs font-bold uppercase tracking-wide text-suave md:grid">
                <span>Fecha</span>
                <span>Tienda</span>
                <span>Tracking</span>
                <span>Estado</span>
                <span />
              </div>
              <ul className="divide-y divide-linea">
                {tandas.visibles.map((fila) => (
                  <li key={fila.clave} className="flex items-center gap-2">
                    <Link to={`/cuenta/envios/${fila.envioId}`} className="grid min-w-0 flex-1 items-center gap-1 px-3 py-4 hover:bg-marino-50/60 md:grid-cols-[1fr_1fr_1.6fr_1fr_28px] md:gap-4">
                      <span className="text-sm text-suave">{formatearFecha(fila.fecha)}</span>
                      <span className="truncate font-bold text-marino-900">{fila.tienda === 'Sin prealerta' ? 'Sin prealerta' : fila.tienda}</span>
                      <span className="codigo truncate text-sm">{fila.tracking}</span>
                      <span><span className={`insignia ${TONO[fila.estado]}`}>{TEXTO[fila.estado]}</span></span>
                      <FiChevronRight className="hidden text-suave md:block" aria-hidden />
                    </Link>
                    {fila.eliminable ? (
                      <button type="button" className="btn btn-fantasma btn-chico shrink-0 text-rojo-700" aria-label={`Eliminar la alerta del tracking ${fila.tracking}`} onClick={() => void eliminar(fila)}>
                        <FiTrash2 aria-hidden />
                      </button>
                    ) : (
                      <span className="w-10 shrink-0" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
              <PieTandas total={tandas.total} mostrados={tandas.mostrados} hayMas={tandas.hayMas} verMas={tandas.verMas} />
            </div>
          )}
        </div>
      </ContenidoCuenta>
    </>
  );
}
