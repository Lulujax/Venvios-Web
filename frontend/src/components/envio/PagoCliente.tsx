import { useState, type FormEvent } from 'react';
import { FiCopy } from 'react-icons/fi';
import { FotoInput } from '../FotoInput';
import { Alerta, Campo, Seleccion, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { formatearBs, formatearUsd } from '../../lib/formato';
import { monedaDelMetodo, TEXTO_MONEDA } from '../../lib/pago';
import type { Envio, InfoPago } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { validarReferencia } from '../../lib/validar';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const avisar = useAviso();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-suave">{etiqueta}</p>
        <p className="truncate font-mono text-sm font-bold">{valor}</p>
      </div>
      <button type="button" className="btn btn-suave btn-chico shrink-0" aria-label={`Copiar ${etiqueta}`} onClick={() => void navigator.clipboard?.writeText(valor).then(() => avisar('Copiado.'))}>
        <FiCopy aria-hidden />
      </button>
    </div>
  );
}

export function PagoCliente({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const { datos: info, error: errorInfo } = useCarga(() => api.get<InfoPago>(`/envios/${envio.id}/pago`), [envio.id, envio.pagadoCentavos]);
  const [metodo, setMetodo] = useState('PAGO_MOVIL');
  const moneda = monedaDelMetodo(metodo);
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errores, setErrores] = useState<{ referencia?: string; archivo?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enRevision = envio.pagos.some((p) => p.estado === 'POR_CONFIRMAR');

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = { referencia: validarReferencia(referencia, metodo) ?? undefined, archivo: archivo ? undefined : 'Sube la captura de tu pago.' };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean) || !archivo || !info) return;
    const montoExacto = moneda === 'USD' ? info.saldoCentavos : info.saldoBsCentavos;
    setEnviando(true);
    setError(null);
    try {
      const formulario = new FormData();
      formulario.set('metodo', metodo);
      formulario.set('moneda', moneda);
      formulario.set('monto', (montoExacto / 100).toFixed(2));
      formulario.set('referencia', referencia.replace(/\s/g, ''));
      formulario.set('archivo', archivo);
      const respuesta = await api.post<{ envio: Envio }>(`/envios/${envio.id}/pagos`, formulario);
      alCambiar(respuesta.envio);
      setReferencia('');
      setArchivo(null);
      avisar('Recibimos tu comprobante. Lo estamos verificando.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  if (errorInfo) return <Alerta tono="error">{errorInfo}</Alerta>;
  if (!info) return null;
  const { datosPago } = info;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-oro/60 bg-oro-50 p-4">
        <p className="text-sm font-semibold text-marino-900">Saldo a pagar</p>
        <p className="font-display text-3xl font-bold text-marino-900">{formatearUsd(info.saldoCentavos)}</p>
        <p className="text-sm font-semibold text-suave">≈ {formatearBs(info.saldoBsCentavos)} a tasa BCV {info.tasa.bolivaresPorUsd.toFixed(2)}{info.tasa.desactualizada ? ' (de otro día)' : ''}</p>
      </div>

      {datosPago.esPrueba && <Alerta tono="aviso">Estos datos de pago son de prueba. No transfieras dinero todavía.</Alerta>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-linea p-4">
          <h3 className="mb-1 text-base">Pago móvil</h3>
          <div className="divide-y divide-linea">
            <Dato etiqueta="Banco" valor={datosPago.pagoMovil.banco} />
            <Dato etiqueta="Cédula" valor={datosPago.pagoMovil.cedula} />
            <Dato etiqueta="Teléfono" valor={datosPago.pagoMovil.telefono} />
          </div>
        </div>
        <div className="rounded-2xl border border-linea p-4">
          <h3 className="mb-1 text-base">Transferencia</h3>
          <div className="divide-y divide-linea">
            <Dato etiqueta="Banco" valor={datosPago.cuenta.banco} />
            <Dato etiqueta="Cuenta" valor={datosPago.cuenta.numero} />
            <Dato etiqueta="Titular" valor={`${datosPago.cuenta.titular} · ${datosPago.cuenta.cedula}`} />
          </div>
        </div>
        <div className="rounded-2xl border border-linea p-4 md:col-span-2">
          <h3 className="mb-1 text-base">Binance</h3>
          <div className="divide-y divide-linea">
            <Dato etiqueta="Usuario" valor={datosPago.binance.usuario} />
            <Dato etiqueta="Correo" valor={datosPago.binance.correo} />
          </div>
          {datosPago.binance.nota && <p className="ayuda">{datosPago.binance.nota}</p>}
        </div>
      </div>
      <p className="text-sm font-semibold text-suave">{datosPago.notaVerificacion}</p>

      {enRevision && <Alerta tono="info">Tienes un comprobante en revisión. Te avisamos por WhatsApp cuando lo verifiquemos.</Alerta>}

      {!enRevision && (
      <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-linea bg-white p-4" noValidate>
        <h3 className="text-base">Subir comprobante</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Seleccion etiqueta="Pagaste por" value={metodo} onChange={(e) => {
            setMetodo(e.target.value);
            setReferencia('');
            setErrores({});
          }} opciones={[{ valor: 'PAGO_MOVIL', texto: 'Pago móvil' }, { valor: 'TRANSFERENCIA', texto: 'Transferencia' }, { valor: 'BINANCE', texto: 'Binance' }]} />
          <Seleccion etiqueta="Moneda" value={moneda} onChange={() => undefined} disabled opciones={[{ valor: moneda, texto: TEXTO_MONEDA[moneda] }]} />
          <Campo etiqueta={`Monto a pagar (${moneda === 'USD' ? '$' : 'Bs'})`} value={moneda === 'USD' ? formatearUsd(info.saldoCentavos) : formatearBs(info.saldoBsCentavos)} readOnly aria-readonly="true" className="[&_input]:bg-papel [&_input]:font-bold" ayuda="Paga exactamente este monto." />
          {metodo === 'BINANCE' ? (
            <Campo etiqueta="ID de transacción" autoCapitalize="none" autoComplete="off" value={referencia} onChange={(e) => setReferencia(e.target.value.replace(/[^A-Za-z0-9]/g, ''))} error={errores.referencia} />
          ) : (
            <Campo etiqueta="Últimos 6 a 12 dígitos de la referencia" inputMode="numeric" maxLength={12} autoComplete="off" value={referencia} onChange={(e) => setReferencia(e.target.value.replace(/\D/g, '').slice(0, 12))} error={errores.referencia} ayuda="Recomendado: entre 6 y 12 dígitos, solo números." placeholder="123456" />
          )}
        </div>
        <Alerta tono="aviso">Paga el monto exacto. Si pagaste un monto distinto, escríbele a administración por WhatsApp antes de subir el comprobante.</Alerta>
        <FotoInput etiqueta="Captura del pago" archivo={archivo} onChange={setArchivo} />
        {errores.archivo && <p className="ayuda font-semibold text-rojo">{errores.archivo}</p>}
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar comprobante'}</button>
      </form>
      )}
    </div>
  );
}
