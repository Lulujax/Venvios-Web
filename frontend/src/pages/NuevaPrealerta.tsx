import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { Alerta, Campo, Seccion } from '../components/ui';
import { api, ErrorApi, mensajeDeError } from '../lib/api';
import { aNumero, DESCRIPCION_MODALIDAD, NOMBRE_MODALIDAD } from '../lib/formato';
import type { Envio, Modalidad, Transportista, Usuario } from '../lib/tipos';
import { validarTracking } from '../lib/validar';

function ElegirCliente({ cliente, onElegir }: { cliente: Usuario | null; onElegir: (cliente: Usuario | null) => void }) {
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function buscar(texto: string) {
    setConsulta(texto);
    if (texto.trim().length < 3) return setResultados([]);
    try {
      setResultados((await api.get<{ clientes: Usuario[] }>(`/staff/clientes?q=${encodeURIComponent(texto)}`)).clientes);
      setError(null);
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-marino-50 px-4 py-3">
        <p className="text-sm"><b>{cliente.nombre}</b> · cédula {cliente.cedulaEnmascarada}</p>
        <button type="button" className="btn btn-suave btn-chico" onClick={() => onElegir(null)}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Campo etiqueta="Buscar cliente" value={consulta} onChange={(e) => void buscar(e.target.value)} ayuda="Por nombre, teléfono o cédula (mínimo 3 caracteres). El cliente debe tener cuenta." />
      {error && <Alerta tono="error">{error}</Alerta>}
      {consulta.trim().length >= 3 && resultados.length === 0 && !error && <p className="text-sm text-suave">No encontramos a nadie. Pídele que cree su cuenta en la página.</p>}
      <ul className="space-y-2">
        {resultados.map((c) => (
          <li key={c.id}>
            <button type="button" className="flex w-full items-center justify-between rounded-2xl border border-linea px-4 py-3 text-left text-sm hover:bg-marino-50" onClick={() => onElegir(c)}>
              <span><b>{c.nombre}</b> · {c.cedulaEnmascarada}</span><span className="font-bold text-marino">Elegir</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NuevaPrealerta({ personal }: { personal: boolean }) {
  const navegar = useNavigate();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [trackings, setTrackings] = useState(['']);
  const [tienda, setTienda] = useState('');
  const [valor, setValor] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad>('M2');
  const [transportista, setTransportista] = useState<Transportista>('MRW');
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
      const r = await api.post<{ envio: Envio }>('/envios', { clienteId: cliente?.id, trackings: limpios, tienda, valorDeclaradoUsd: valorUsd, modalidad, transportista });
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
      <p className="mb-6 mt-2 text-suave">Anota los números de tracking de lo que compraste. Cuando lleguen a nuestra oficina los escaneamos y te avisamos.</p>

      <form onSubmit={enviar} className="space-y-6" noValidate>
        {personal && (
          <Seccion titulo="Cliente">
            <ElegirCliente cliente={cliente} onElegir={setCliente} />
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

        <Seccion titulo="¿Con quién se envía a Venezuela?">
          <div className="grid grid-cols-2 gap-3">
            {(['MRW', 'ZOOM'] as Transportista[]).map((t) => (
              <label key={t} className={`flex min-h-[56px] cursor-pointer items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition ${transportista === t ? 'border-marino bg-marino text-white' : 'border-linea bg-white text-marino-900'}`}>
                <input type="radio" name="transportista" className="sr-only" checked={transportista === t} onChange={() => setTransportista(t)} />
                {t === 'ZOOM' ? 'Zoom' : 'MRW'}
              </label>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="¿Cómo prefieres pagar?">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['M2', 'M1'] as Modalidad[]).map((m) => (
              <label key={m} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${modalidad === m ? 'border-marino bg-marino-50' : 'border-linea bg-white'}`}>
                <input type="radio" name="modalidad" className="sr-only" checked={modalidad === m} onChange={() => setModalidad(m)} />
                <span className="block font-display text-lg font-bold text-marino-900">{NOMBRE_MODALIDAD[m]}</span>
                <span className="mt-1 block text-sm text-suave">{DESCRIPCION_MODALIDAD[m]}</span>
              </label>
            ))}
          </div>
          <p className="ayuda">Si tu envío pesa menos de 2 kg, el cobro a destino es lo más conveniente. Podrás cambiarlo antes de pagar.</p>
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
