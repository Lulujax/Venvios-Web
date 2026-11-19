import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../lib/api';
import { DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD, aNumero, formatearBs, formatearKg, formatearUsd } from '../lib/formato';
import type { Cotizacion } from '../lib/tipos';
import { Alerta, Campo } from './ui';

export function Calculadora() {
  const [kilos, setKilos] = useState('3');
  const [valor, setValor] = useState('60');
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pesoKg = aNumero(kilos);
    const valorUsd = valor.trim() === '' ? 0 : aNumero(valor);
    if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
      setCotizacion(null);
      setError(kilos.trim() === '' ? null : 'Escribe un peso mayor que cero.');
      return;
    }
    if (!Number.isFinite(valorUsd) || valorUsd < 0) {
      setError('El valor declarado no puede ser negativo.');
      return;
    }
    let vigente = true;
    const temporizador = setTimeout(() => {
      api
        .post<Cotizacion>('/publico/calculadora', { pesoKg, valorDeclaradoUsd: valorUsd })
        .then((respuesta) => {
          if (!vigente) return;
          setCotizacion(respuesta);
          setError(null);
        })
        .catch((falla) => vigente && setError(mensajeDeError(falla)));
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [kilos, valor]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <div className="space-y-4">
        <Campo etiqueta="Peso del envío (kg)" inputMode="decimal" value={kilos} onChange={(e) => setKilos(e.target.value)} ayuda="Suma el peso de todos tus paquetes." />
        <Campo etiqueta="Valor declarado ($)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} ayuda="Lo que costó tu compra. Sirve para el seguro de carga." />
        {error && <Alerta tono="error">{error}</Alerta>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
        {cotizacion ? (
          cotizacion.opciones.map((opcion) => {
            const sugerida = cotizacion.modalidadSugerida === opcion.modalidad;
            return (
              <article key={opcion.modalidad} className={`relative rounded-tarjeta border p-5 ${sugerida ? 'border-oro bg-oro-50' : 'border-linea bg-white'}`}>
                {sugerida && <span className="insignia absolute -top-3 left-5 bg-oro text-marino-900">Recomendada para este peso</span>}
                <h3 className="text-lg">{NOMBRE_MODALIDAD[opcion.modalidad]}</h3>
                <p className="mt-1 min-h-[40px] text-sm text-suave">{DESCRIPCION_MODALIDAD[opcion.modalidad]}</p>
                <p className="mt-4 font-display text-4xl font-bold text-marino-900">{formatearUsd(opcion.totalCentavos)}</p>
                {opcion.totalBsCentavos !== null && <p className="text-sm font-semibold text-suave">≈ {formatearBs(opcion.totalBsCentavos)}</p>}
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-suave">Peso cobrado</dt><dd className="font-bold">{formatearKg(opcion.pesoCobrableCentesimas / 100)}</dd></div>
                  <div className="flex justify-between"><dt className="text-suave">Flete</dt><dd className="font-bold">{formatearUsd(opcion.fleteCentavos)}</dd></div>
                  <div className="flex justify-between"><dt className="text-suave">Seguro de carga</dt><dd className="font-bold">{formatearUsd(opcion.seguroCentavos)}</dd></div>
                </dl>
                {opcion.cobroADestino && <p className="mt-3 text-xs font-semibold text-marino">+ el tramo en Venezuela lo pagas a MRW o Zoom al recibir.</p>}
              </article>
            );
          })
        ) : (
          <p className="rounded-tarjeta border border-dashed border-linea p-6 text-sm text-suave sm:col-span-2">Escribe el peso para ver cuánto pagarías.</p>
        )}
      </div>
    </div>
  );
}
