import { Link } from 'react-router-dom';
import { FiBell, FiCopy, FiCreditCard, FiLayers, FiPackage, FiPlus } from 'react-icons/fi';
import { ContenidoCuenta, EncabezadoCuenta, TarjetaCifra, useEnviosCliente } from '../../components/CuentaPiezas';
import { Cargando, ErrorCarga, useAviso } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { resumirCuenta } from '../../lib/cuenta';
import { formatearUsd, primerNombre } from '../../lib/formato';
import type { InfoPublica } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';

function FilaDireccion({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const avisar = useAviso();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-linea py-3 last:border-b-0">
      <p className="min-w-0 text-sm">
        <span className="font-bold text-suave">{etiqueta}: </span>
        <span className="break-words font-bold text-marino-900">{valor}</span>
      </p>
      <button type="button" className="btn btn-suave btn-chico shrink-0" aria-label={`Copiar ${etiqueta}`} onClick={() => void navigator.clipboard?.writeText(valor).then(() => avisar('Copiado.'))}>
        <FiCopy aria-hidden />
      </button>
    </div>
  );
}

export function Inicio() {
  const { usuario } = useAuth();
  const { datos, cargando, error, recargar } = useEnviosCliente();
  const { datos: info } = useCarga(() => api.get<InfoPublica>('/publico/info'));
  const resumen = datos ? resumirCuenta(datos) : null;

  return (
    <>
      <EncabezadoCuenta
        titulo={`Hola, ${usuario ? primerNombre(usuario.nombre) : ''}`}
        subtitulo={<span className="codigo inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">Casillero {usuario?.codigo}</span>}
        derecha={<Link to="/cuenta/nuevo" className="btn btn-acento"><FiPlus aria-hidden /> Crear alerta</Link>}
      />
      <ContenidoCuenta>
        {cargando && <Cargando lineas={2} />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        {resumen && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaCifra
              titulo="Alertas pendientes"
              valor={String(resumen.alertasPendientes)}
              icono={FiBell}
              detalle="Paquetes que aún no llegan"
              a="/cuenta/mis-envios?pestana=PREALERTAS"
              enlace="Ver alertas"
            />
            <TarjetaCifra
              titulo="En bodega"
              valor={String(resumen.enBodega)}
              icono={FiLayers}
              detalle="Listos para que elijas cuáles enviar"
              a="/cuenta/consolidar"
              enlace="Consolidar envío"
            />
            <TarjetaCifra
              titulo="Por pagar"
              valor={formatearUsd(resumen.saldoPorPagarCentavos)}
              icono={FiCreditCard}
              detalle={<>{resumen.porPagar} {resumen.porPagar === 1 ? 'envío listo' : 'envíos listos'} para pagar</>}
              a="/cuenta/finanzas"
              enlace="Ir a finanzas"
            />
            <TarjetaCifra
              titulo="Pedidos pagados"
              valor={String(resumen.pagados)}
              icono={FiPackage}
              detalle="Historial de tus envíos"
              a="/cuenta/mis-envios?pestana=ACTIVOS"
              enlace="Ver pedidos"
            />
          </div>
        )}

        <section className="tarjeta mt-8 p-5 sm:p-6" aria-labelledby="titulo-direccion">
          <h2 id="titulo-direccion" className="text-xl">¿Cómo enviar tus compras a tu casillero?</h2>
          <p className="mt-1 text-sm text-suave">Usa estos datos como dirección de entrega en la tienda. Tu número de casillero va en el nombre para que identifiquemos tu paquete.</p>
          <div className="mt-4 rounded-2xl border border-linea px-4">
            <FilaDireccion etiqueta="Nombre" valor={`${usuario?.codigo ?? ''} - ${usuario?.nombre ?? ''}`} />
            <FilaDireccion etiqueta="Dirección" valor={info?.contacto.direccion ?? 'Cúcuta, Colombia'} />
          </div>
        </section>
      </ContenidoCuenta>
    </>
  );
}
