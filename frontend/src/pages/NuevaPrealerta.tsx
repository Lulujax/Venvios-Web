import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { BuscadorCliente } from '../components/BuscadorCliente';
import { Alerta, Campo, Seccion } from '../components/ui';
import { api, ErrorApi, mensajeDeError } from '../lib/api';
import { aNumero, formatearUsd } from '../lib/formato';
import type { Envio, Usuario } from '../lib/tipos';
import { validarTracking } from '../lib/validar';

interface FilaGuia {
  tracking: string;
  valor: string;
}

const MAX_GUIAS = 20;

export default function NuevaPrealerta({ personal }: { personal: boolean }) {
  const navegar = useNavigate();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [filas, setFilas] = useState<FilaGuia[]>([{ tracking: '', valor: '' }]);
  const [tienda, setTienda] = useState('');
  const [errores, setErrores] = useState<{ trackings?: string; valores?: string; cliente?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [existente, setExistente] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarFila = (indice: number, campo: keyof FilaGuia, texto: string) => setFilas((lista) => lista.map((fila, i) => (i === indice ? { ...fila, [campo]: texto } : fila)));
  const llenas = filas.filter((fila) => fila.tracking.trim() !== '');
  const totalCentavos = llenas.reduce((suma, fila) => {
    const valor = aNumero(fila.valor || '0');
    return suma + (Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : 0);
  }, 0);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpias = filas.map((fila) => ({ tracking: fila.tracking.trim(), valor: fila.valor.trim() })).filter((fila) => fila.tracking !== '');
    const valores = limpias.map((fila) => (fila.valor === '' ? NaN : aNumero(fila.valor)));
    const nuevos = {
      trackings: limpias.length === 0 ? 'Agrega al menos un número de tracking.' : (limpias.map((fila) => validarTracking(fila.tracking)).find(Boolean) ?? undefined),
      valores: valores.some((valor) => !Number.isFinite(valor) || valor < 0) ? 'Escribe cuánto costó cada paquete en dólares (0 si no sabes).' : undefined,
      cliente: personal && !cliente ? 'Elige el cliente.' : undefined,
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    setError(null);
    setExistente(null);
    try {
      const r = await api.post<{ envio: Envio }>('/envios', { clienteId: cliente?.id, trackings: limpias.map((fila) => fila.tracking), tienda, valoresUsd: valores });
      navegar(personal ? `/panel/envios/${r.envio.id}` : `/cuenta/envios/${r.envio.id}`, { replace: true });
    } catch (falla) {
      setError(mensajeDeError(falla));
      if (falla instanceof ErrorApi && typeof falla.datos?.envioId === 'string') setExistente(falla.datos.envioId);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor max-w-3xl py-6 sm:py-8">
      <h1 className="text-3xl">{personal ? 'Nueva prealerta' : 'Registrar paquetes'}</h1>
      <p className="mb-6 mt-2 text-suave">Anota los números de tracking de lo que compraste. Cuando lleguen a nuestra oficina te avisamos. Después eliges qué paquetes se envían juntos.</p>

      <form onSubmit={enviar} className="space-y-6" noValidate>
        {personal && (
          <Seccion titulo="Cliente">
            <BuscadorCliente cliente={cliente} onElegir={setCliente} />
            {errores.cliente && <p className="ayuda font-semibold text-rojo">{errores.cliente}</p>}
          </Seccion>
        )}

        <Seccion titulo="Paquetes">
          <div className="space-y-3">
            {filas.map((fila, indice) => (
              <div key={indice} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_9rem_auto]">
                <Campo className="col-span-2 sm:col-span-1" etiqueta={`Tracking del paquete ${indice + 1}`} value={fila.tracking} onChange={(e) => cambiarFila(indice, 'tracking', e.target.value)} placeholder="Ej. XC000123456" autoComplete="off" />
                <Campo etiqueta={`Valor del paquete ${indice + 1} ($)`} inputMode="decimal" value={fila.valor} onChange={(e) => cambiarFila(indice, 'valor', e.target.value)} placeholder="0.00" />
                {filas.length > 1 ? <button type="button" className="btn btn-suave" aria-label={`Quitar paquete ${indice + 1}`} onClick={() => setFilas((l) => l.filter((_, i) => i !== indice))}><FiTrash2 aria-hidden /></button> : <span />}
              </div>
            ))}
            {errores.trackings && <p className="ayuda font-semibold text-rojo">{errores.trackings}</p>}
            {errores.valores && <p className="ayuda font-semibold text-rojo">{errores.valores}</p>}
            {filas.length < MAX_GUIAS && <button type="button" className="btn btn-suave btn-chico" onClick={() => setFilas((l) => [...l, { tracking: '', valor: '' }])}><FiPlus aria-hidden /> Agregar otro paquete</button>}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Tienda" value={tienda} onChange={(e) => setTienda(e.target.value)} placeholder="Shein, AliExpress, Amazon…" />
            <div className="rounded-2xl bg-marino-50 p-4 text-sm">
              <p className="text-suave">Valor declarado total</p>
              <p className="font-display text-xl font-bold text-marino-900">{formatearUsd(totalCentavos)}</p>
              <p className="ayuda">Lo que costó cada paquete. Con esto se calcula el seguro de carga.</p>
            </div>
          </div>
        </Seccion>

        {error && (
          <Alerta tono="error">
            <p>{error}</p>
            {existente && <Link className="mt-2 inline-block font-bold underline" to={personal ? `/panel/envios/${existente}` : `/cuenta/envios/${existente}`}>Ver el envío que ya existe</Link>}
          </Alerta>
        )}
        <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar paquetes'}</button>
      </form>
    </div>
  );
}
