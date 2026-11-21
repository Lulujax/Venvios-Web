import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, useEnviosCliente } from '../../components/CuentaPiezas';
import { ElegirModalidad, ElegirTransportista } from '../../components/OpcionesEnvio';
import { ResumenEntregaPerfil, entregaPerfilCompleta } from '../../components/envio/ResumenEntrega';
import { Alerta, Cargando, ErrorCarga, Vacio } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { paquetesEnBodega, sumaValoresCentavos } from '../../lib/cuenta';
import { formatearFecha, formatearKg, formatearUsd } from '../../lib/formato';
import type { Envio, Modalidad, PerfilVista, Transportista } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

export function Consolidar() {
  const navegar = useNavigate();
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const perfil = useCarga(() => api.get<PerfilVista>('/perfil'));
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [modalidad, setModalidad] = useState<Modalidad>('M1');
  const [transportista, setTransportista] = useState<Transportista>('MRW');
  const [errores, setErrores] = useState<{ elegidos?: string }>({});
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const bodega = datos ? paquetesEnBodega(datos) : [];
  const seleccion = bodega.filter((p) => elegidos.includes(p.paqueteId));
  const valorTotalCentavos = sumaValoresCentavos(seleccion);

  function alternar(paqueteId: string) {
    setElegidos((actuales) => (actuales.includes(paqueteId) ? actuales.filter((id) => id !== paqueteId) : [...actuales, paqueteId]));
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = { elegidos: elegidos.length === 0 ? 'Elige al menos un paquete.' : undefined };
    setErrores(nuevos);
    if (nuevos.elegidos) return;
    if (perfil.datos && !entregaPerfilCompleta(perfil.datos, transportista)) {
      setErrorEnvio('Completa tus datos de entrega en tu perfil antes de pedir el envío.');
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const r = await api.post<{ envio: Envio }>('/envios/consolidar', { paqueteIds: elegidos, modalidad, transportista });
      navegar(`/cuenta/envios/${r.envio.id}`, { replace: true });
    } catch (falla) {
      setErrorEnvio(mensajeDeError(falla));
      void recargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <EncabezadoCuenta titulo="Consolidar envío" subtitulo="Elige qué paquetes de tu bodega viajan juntos. Los pesamos juntos y te damos el total." />
      <ContenidoCuenta>
        {cargando && <Cargando />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        {datos && bodega.length === 0 && (
          <div className="tarjeta p-5 sm:p-6">
            <Vacio titulo="No tienes paquetes en bodega" texto="Cuando lleguen tus paquetes a nuestra oficina aparecerán aquí para que elijas cuáles enviar." accion={<Link to="/cuenta/alertas" className="btn btn-primario">Ver mis alertas</Link>} />
          </div>
        )}
        {bodega.length > 0 && (
          <form onSubmit={enviar} className="space-y-6" noValidate>
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-bodega">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="titulo-bodega" className="text-xl">Tus paquetes en bodega</h2>
                <button type="button" className="btn btn-suave btn-chico" onClick={() => setElegidos(elegidos.length === bodega.length ? [] : bodega.map((p) => p.paqueteId))}>
                  {elegidos.length === bodega.length ? 'Quitar todos' : 'Elegir todos'}
                </button>
              </div>
              <ul className="space-y-2">
                {bodega.map((paquete) => {
                  const marcado = elegidos.includes(paquete.paqueteId);
                  return (
                    <li key={paquete.paqueteId}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition focus-within:ring-4 focus-within:ring-marino/20 ${marcado ? 'border-marino bg-marino-50' : 'border-linea bg-white'}`}>
                        <input type="checkbox" className="sr-only" checked={marcado} onChange={() => alternar(paquete.paqueteId)} />
                        {marcado ? <FiCheckSquare className="shrink-0 text-2xl text-marino" aria-hidden /> : <FiSquare className="shrink-0 text-2xl text-suave" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="codigo block truncate">{paquete.tracking}</span>
                          <span className="block text-xs text-suave">
                            {paquete.tienda === 'Sin prealerta' || paquete.tienda === 'Devuelto a bodega' ? 'En bodega' : paquete.tienda}
                            {paquete.recibidoEn ? ` · llegó ${formatearFecha(paquete.recibidoEn)}` : ''}
                            {paquete.pesoKg ? ` · ${formatearKg(paquete.pesoKg)}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {errores.elegidos && <p className="ayuda font-semibold text-rojo">{errores.elegidos}</p>}
              <p className="ayuda">Los paquetes que no elijas se quedan guardados en bodega hasta que los envíes.</p>
            </section>

            <section className="tarjeta space-y-5 p-5 sm:p-6" aria-labelledby="titulo-opciones">
              <h2 id="titulo-opciones" className="text-xl">Cómo se envía</h2>
              <ElegirTransportista valor={transportista} alCambiar={setTransportista} />
              <ElegirModalidad valor={modalidad} alCambiar={setModalidad} />
              <ResumenEntregaPerfil perfil={perfil.datos} transportista={transportista} />
              <div className="rounded-2xl bg-marino-50 p-4 text-sm">
                <p className="text-suave">Valor declarado del envío</p>
                <p className="font-display text-2xl font-bold text-marino-900">{formatearUsd(valorTotalCentavos)}</p>
                <p className="ayuda">Es la suma del valor de los paquetes que elegiste. Con esto se calcula el seguro de carga.</p>
              </div>
            </section>

            {errorEnvio && <Alerta tono="error">{errorEnvio}</Alerta>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primario" disabled={enviando}>{enviando ? 'Enviando…' : `Consolidar ${elegidos.length > 0 ? `${elegidos.length} paquete(s)` : ''}`}</button>
              <p className="text-sm text-suave">Te escribimos por WhatsApp con el total cuando lo pesemos.</p>
            </div>
          </form>
        )}
      </ContenidoCuenta>
    </>
  );
}
