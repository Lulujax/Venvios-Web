import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { BuscadorCliente } from '../components/BuscadorCliente';
import { Alerta, Campo, Seccion } from '../components/ui';
import { api, ErrorApi, mensajeDeError } from '../lib/api';
import { aNumero } from '../lib/formato';
import type { Envio, Usuario } from '../lib/tipos';
import { validarTracking } from '../lib/validar';

export default function NuevaPrealerta({ personal }: { personal: boolean }) {
  const navegar = useNavigate();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [trackings, setTrackings] = useState(['']);
  const [tienda, setTienda] = useState('');
  const [valor, setValor] = useState('');
  const [errores, setErrores] = useState<{ trackings?: string; valor?: string; cliente?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [existente, setExistente] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarTracking = (indice: number, texto: string) => setTrackings((lista) => lista.map((t, i) => (i === indice ? texto : t)));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpios = trackings.map((t) => t.trim()).filter(Boolean);
    const valorUsd = valor.trim() === '' ? NaN : aNumero(valor);
    const nuevos = {
      trackings: limpios.length === 0 ? 'Agrega al menos un número de tracking.' : (limpios.map(validarTracking).find(Boolean) ?? undefined),
      valor: Number.isFinite(valorUsd) && valorUsd >= 0 ? undefined : 'Escribe cuánto costó tu compra en dólares (0 si no sabes).',
      cliente: personal && !cliente ? 'Elige el cliente.' : undefined,
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    setError(null);
    setExistente(null);
    try {
      const r = await api.post<{ envio: Envio }>('/envios', { clienteId: cliente?.id, trackings: limpios, tienda, valorDeclaradoUsd: valorUsd });
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
            {trackings.map((tracking, indice) => (
              <div key={indice} className="flex items-end gap-2">
                <Campo className="flex-1" etiqueta={`Tracking del paquete ${indice + 1}`} value={tracking} onChange={(e) => cambiarTracking(indice, e.target.value)} placeholder="Ej. XC000123456" autoComplete="off" />
                {trackings.length > 1 && <button type="button" className="btn btn-suave" aria-label={`Quitar paquete ${indice + 1}`} onClick={() => setTrackings((l) => l.filter((_, i) => i !== indice))}><FiTrash2 aria-hidden /></button>}
              </div>
            ))}
            {errores.trackings && <p className="ayuda font-semibold text-rojo">{errores.trackings}</p>}
            {trackings.length < 20 && <button type="button" className="btn btn-suave btn-chico" onClick={() => setTrackings((l) => [...l, ''])}><FiPlus aria-hidden /> Agregar otro paquete</button>}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Tienda" value={tienda} onChange={(e) => setTienda(e.target.value)} placeholder="Shein, AliExpress, Amazon…" />
            <Campo etiqueta="Valor declarado ($)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} error={errores.valor} ayuda="Lo que costó la compra. Con esto se calcula el seguro de carga." />
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
