import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { PieTandas, useTandas } from '../../components/Tandas';
import { Alerta, Cargando, ErrorCarga, Vacio, useAviso } from '../../components/ui';
import { useConfirmar } from '../../components/Confirmar';
import { api, mensajeDeError } from '../../lib/api';
import { formatearFecha, formatearUsd } from '../../lib/formato';
import { PESTANAS, esPestana, filasDePestana, type FilaEnvio, type Pestana } from '../../lib/misEnvios';

const VACIOS: Record<Pestana, { titulo: string; texto: string }> = {
  PREALERTAS: { titulo: 'No tienes pre-alertas', texto: 'Registra el tracking de tus compras para que te avisemos cuando lleguen.' },
  ACTIVOS: { titulo: 'No tienes envíos en curso', texto: 'Cuando consolides tus paquetes, tu envío aparecerá aquí.' },
  ENTREGADOS: { titulo: 'Todavía no tienes envíos entregados', texto: 'Aquí verás los envíos que ya recibiste.' },
};

function enlaceRastrear(fila: FilaEnvio): string {
  return `/cuenta/rastrear?q=${encodeURIComponent(fila.busqueda)}`;
}

export function MisEnvios() {
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const avisar = useAviso();
  const [params, setParams] = useSearchParams();
  const crudo = params.get('pestana');
  const pestana: Pestana = esPestana(crudo) ? crudo : 'PREALERTAS';
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const filas = datos ? filasDePestana(datos, pestana) : [];
  const tandas = useTandas(filas);

  function elegir(valor: Pestana) {
    setParams({ pestana: valor }, { replace: true });
  }

  const pedirConfirmacion = useConfirmar();

  async function eliminar(fila: FilaEnvio) {
    if (!fila.paqueteId) return;
    if (!(await pedirConfirmacion({ titulo: '¿Eliminar la alerta?', pregunta: `Se quitará la alerta del tracking ${fila.guia}.`, accion: 'Eliminar alerta', peligro: true }))) return;
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
        titulo="Mis envíos"
        subtitulo="Tus pre-alertas, tus envíos en curso y los que ya recibiste."
        derecha={<Link to="/cuenta/nuevo" className="btn btn-acento"><FiPlus aria-hidden /> Crear alerta</Link>}
      />
      <ContenidoCuenta>
        <div className="tarjeta p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Mis envíos">
            {PESTANAS.map((opcion) => (
              <button key={opcion.valor} type="button" role="tab" aria-selected={pestana === opcion.valor} onClick={() => elegir(opcion.valor)} className={`btn btn-chico ${pestana === opcion.valor ? 'btn-primario' : 'btn-suave'}`}>
                {opcion.texto}
              </button>
            ))}
          </div>

          {cargando && !datos && <Cargando />}
          {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
          {errorEliminar && <Alerta tono="error" className="mb-4">{errorEliminar}</Alerta>}
          {datos && filas.length === 0 && <Vacio titulo={VACIOS[pestana].titulo} texto={VACIOS[pestana].texto} />}

          {filas.length > 0 && (
            <div role="tabpanel">
              <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-linea px-3 pb-3 text-xs font-bold uppercase tracking-wide text-suave md:grid">
                <span>Guía</span>
                <span>Estado</span>
                <span>Fecha</span>
                <span>Valor declarado</span>
                <span>Total</span>
                <span className="sr-only">Opciones</span>
              </div>
              <ul className="divide-y divide-linea">
                {tandas.visibles.map((fila) => (
                  <li key={fila.clave} className="grid gap-2 px-3 py-4 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
                    <Link to={enlaceRastrear(fila)} className="codigo truncate font-bold text-marino underline-offset-4 hover:underline">{fila.guia}</Link>
                    <span><span className="insignia bg-marino-100 text-marino">{fila.estado}</span></span>
                    <span className="text-sm text-suave"><span className="md:hidden">Fecha: </span>{formatearFecha(fila.fecha)}</span>
                    <span className="text-sm"><span className="text-suave md:hidden">Valor declarado: </span>{formatearUsd(fila.valorCentavos)}</span>
                    <span className="text-sm font-bold text-marino-900"><span className="font-normal text-suave md:hidden">Total: </span>{fila.totalCentavos !== null ? formatearUsd(fila.totalCentavos) : '—'}</span>
                    <span className="flex gap-2">
                      <Link to={enlaceRastrear(fila)} className="btn btn-suave btn-chico" aria-label={`Rastrear ${fila.guia}`}><FiSearch aria-hidden /> Rastrear</Link>
                      {fila.eliminable && (
                        <button type="button" className="btn btn-fantasma btn-chico text-rojo-700" aria-label={`Eliminar la alerta del tracking ${fila.guia}`} onClick={() => void eliminar(fila)}>
                          <FiTrash2 aria-hidden />
                        </button>
                      )}
                    </span>
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
