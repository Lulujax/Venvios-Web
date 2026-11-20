import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FaWhatsapp } from 'react-icons/fa';
import { FiAlertTriangle, FiCheckCircle, FiSearch } from 'react-icons/fi';
import { BuscadorCliente } from '../../components/BuscadorCliente';
import { Escaner } from '../../components/Escaner';
import { Alerta, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero } from '../../lib/formato';
import type { Envio, ResultadoEscaneo, Usuario } from '../../lib/tipos';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

interface Lectura {
  resultado: ResultadoEscaneo;
  hora: string;
}

function TarjetaRecibido({ lectura, alTerminar }: { lectura: Extract<ResultadoEscaneo, { paqueteId: string }>; alTerminar: () => void }) {
  const avisar = useAviso();
  const [peso, setPeso] = useState('');
  const [guardado, setGuardado] = useState<Envio | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function hacer(tarea: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await tarea();
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  const guardarPeso = (evento: FormEvent) => {
    evento.preventDefault();
    void hacer(async () => {
      const kilos = aNumero(peso);
      if (!Number.isFinite(kilos) || kilos <= 0) throw new Error('Escribe un peso mayor que cero.');
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${lectura.paqueteId}/peso`, { pesoKg: kilos });
      setGuardado(r.envio);
      avisar('Peso guardado.');
    });
  };

  const avisarWhatsApp = () =>
    hacer(async () => {
      const mensaje = await pedirMensaje(lectura.envioId, 'llegada', { paqueteId: lectura.paqueteId });
      await enviarPorWhatsApp(mensaje, null);
      setAbierto(true);
    });

  const confirmar = () =>
    hacer(async () => {
      await api.post(`/staff/paquetes/${lectura.paqueteId}/avisado`);
      avisar('Cliente avisado.');
      alTerminar();
    });

  return (
    <div className="space-y-4 rounded-tarjeta border-2 border-verde/50 bg-verde-100/50 p-5">
      <div className="flex items-start gap-3">
        <FiCheckCircle className="mt-1 text-3xl text-verde" aria-hidden />
        <div>
          <p className="font-display text-xl font-bold text-marino-900">Recibido: {lectura.cliente}</p>
          <p className="codigo text-suave">{lectura.texto}</p>
          <p className="text-sm font-semibold">{lectura.faltan === 0 ? 'Ya llegaron todos los paquetes de este envío.' : `Faltan ${lectura.faltan} paquete(s) de este envío.`}</p>
        </div>
      </div>
      <form onSubmit={guardarPeso} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <label htmlFor="peso-rapido" className="etiqueta">Peso del paquete en kg (opcional)</label>
          <input id="peso-rapido" className="campo" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0.00" disabled={Boolean(guardado)} />
        </div>
        {!guardado && <button type="submit" className="btn btn-primario" disabled={ocupado}>Guardar peso</button>}
      </form>
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn bg-[#25D366] text-marino-900" disabled={ocupado || lectura.sinDueno} onClick={() => void avisarWhatsApp()}><FaWhatsapp aria-hidden /> Avisar por WhatsApp</button>
        {abierto && <button type="button" className="btn btn-acento" onClick={() => void confirmar()}>Ya lo envié</button>}
        <Link to={`/panel/envios/${lectura.envioId}`} className="btn btn-suave">Abrir envío</Link>
        <button type="button" className="btn btn-fantasma" onClick={alTerminar}>Siguiente paquete</button>
      </div>
      <p className="ayuda">El total se calcula cuando el cliente consolida su envío y lo pesas completo.</p>
    </div>
  );
}

function TarjetaSinPrealerta({ texto, alTerminar }: { texto: string; alTerminar: () => void }) {
  const avisar = useAviso();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [registrado, setRegistrado] = useState<Envio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function registrar(clienteId?: string) {
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ envio: Envio }>('/staff/sin-prealerta', { texto, clienteId });
      setRegistrado(r.envio);
      avisar(clienteId ? `Guardado en la bodega de ${r.envio.cliente.nombre}.` : 'Guardado en bodega sin dueño.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setOcupado(false);
    }
  }

  if (registrado) {
    return (
      <div className="space-y-3 rounded-tarjeta border-2 border-verde/50 bg-verde-100/50 p-5">
        <p className="flex items-center gap-2 font-display text-xl font-bold text-marino-900"><FiCheckCircle className="text-verde" aria-hidden /> {registrado.sinDueno ? 'En bodega, sin dueño' : `En bodega de ${registrado.cliente.nombre}`}</p>
        <p className="codigo text-suave">{texto}</p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/panel/envios/${registrado.id}`} className="btn btn-suave btn-chico">Abrir</Link>
          <button type="button" className="btn btn-primario btn-chico" onClick={alTerminar}>Siguiente paquete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-tarjeta border-2 border-rojo/40 bg-rojo-100/50 p-5">
      <p className="flex items-center gap-2 font-display text-xl font-bold"><FiAlertTriangle className="text-rojo" aria-hidden /> Sin prealerta</p>
      <p className="text-sm">Nadie tiene una alerta con el tracking <span className="codigo">{texto}</span>. Si la etiqueta trae el casillero (VENV-…) o el nombre, búscalo; si no, déjalo sin dueño hasta que alguien lo reclame.</p>
      <BuscadorCliente cliente={cliente} onElegir={setCliente} etiqueta="¿De quién es?" />
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primario" disabled={ocupado || !cliente} onClick={() => cliente && void registrar(cliente.id)}>Guardar para este cliente</button>
        <button type="button" className="btn btn-suave" disabled={ocupado} onClick={() => void registrar()}>Dejar sin dueño</button>
      </div>
    </div>
  );
}

export default function Escaneo() {
  const [manual, setManual] = useState('');
  const [actual, setActual] = useState<ResultadoEscaneo | null>(null);
  const [recientes, setRecientes] = useState<Lectura[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesar = useCallback(async (texto: string) => {
    const limpio = texto.trim();
    if (limpio.length < 4) return setError('El número es muy corto.');
    setBuscando(true);
    setError(null);
    try {
      const resultado = await api.post<ResultadoEscaneo>('/staff/escaneo', { texto: limpio });
      setActual(resultado);
      setRecientes((lista) => [{ resultado, hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) }, ...lista].slice(0, 8));
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setBuscando(false);
    }
  }, []);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-1 text-3xl">Recibir paquetes</h1>
      <p className="mb-6 text-suave">Escanea el QR o el código de barras de la etiqueta, o toma una foto. Si no se lee, escribe el número.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Escaner onLeido={(t) => void procesar(t)} pausado={buscando} />
          <form onSubmit={(e) => { e.preventDefault(); void procesar(manual); setManual(''); }} className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="tracking-manual" className="etiqueta">O escríbelo a mano</label>
              <input id="tracking-manual" className="campo font-mono" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Número de tracking" autoComplete="off" />
            </div>
            <button type="submit" className="btn btn-primario" disabled={buscando}><FiSearch aria-hidden /> Buscar</button>
          </form>
        </div>

        <div className="space-y-4" aria-live="polite">
          {error && <Alerta tono="error">{error}</Alerta>}
          {buscando && <p className="text-sm font-semibold text-suave">Buscando…</p>}
          {actual?.resultado === 'RECIBIDO' && <TarjetaRecibido key={actual.paqueteId} lectura={actual} alTerminar={() => setActual(null)} />}
          {actual?.resultado === 'YA_REGISTRADO' && (
            <div className="space-y-3 rounded-tarjeta border-2 border-oro bg-oro-50 p-5">
              <p className="flex items-center gap-2 font-display text-xl font-bold"><FiAlertTriangle className="text-oro-600" aria-hidden /> Ya estaba registrado</p>
              <p className="text-sm">El paquete <span className="codigo">{actual.texto}</span> de {actual.cliente} ya fue recibido antes. No se duplicó.</p>
              <Link to={`/panel/envios/${actual.envioId}`} className="btn btn-suave btn-chico">Abrir envío</Link>
            </div>
          )}
          {actual?.resultado === 'SIN_PREALERTA' && <TarjetaSinPrealerta key={actual.texto} texto={actual.texto} alTerminar={() => setActual(null)} />}
          {!actual && !error && !buscando && <p className="rounded-tarjeta border border-dashed border-linea p-6 text-sm text-suave">Aquí verás a quién pertenece el paquete que escanees.</p>}

          {recientes.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg">Escaneados ahora</h2>
              <ul className="divide-y divide-linea rounded-2xl border border-linea bg-white">
                {recientes.map((lectura, indice) => (
                  <li key={indice} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="codigo truncate">{lectura.resultado.texto}</span>
                    <span className="shrink-0 text-xs font-bold text-suave">{lectura.resultado.resultado === 'RECIBIDO' ? 'Recibido' : lectura.resultado.resultado === 'YA_REGISTRADO' ? 'Ya estaba' : 'Sin prealerta'} · {lectura.hora}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
