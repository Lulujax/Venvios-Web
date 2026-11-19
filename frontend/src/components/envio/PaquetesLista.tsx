import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCamera, FiCheck, FiClock, FiPackage } from 'react-icons/fi';
import { FotoInput } from '../FotoInput';
import { Alerta, ImagenPrivada, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero, formatearKg } from '../../lib/formato';
import type { Envio, PaqueteVista } from '../../lib/tipos';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

export function PaquetesCliente({ paquetes }: { paquetes: PaqueteVista[] }) {
  return (
    <ul className="space-y-2">
      {paquetes.map((paquete) => (
        <li key={paquete.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linea px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {paquete.recibido ? <FiCheck className="shrink-0 text-xl text-verde" aria-hidden /> : <FiClock className="shrink-0 text-xl text-suave" aria-hidden />}
            <div className="min-w-0">
              <p className="codigo truncate">{paquete.tracking}</p>
              <p className="text-xs text-suave">{paquete.recibido ? (paquete.pesoKg ? `Llegó · ${formatearKg(paquete.pesoKg)}` : 'Llegó · pendiente de pesar') : 'En camino a nuestra oficina'}</p>
            </div>
          </div>
          {paquete.tieneFoto && <ImagenPrivada ruta={paquete.fotoRuta} alt={`Foto del paquete ${paquete.tracking}`} className="h-12 w-12" />}
        </li>
      ))}
    </ul>
  );
}

interface PaqueteProps {
  envio: Envio;
  paquete: PaqueteVista;
  alCambiar: (envio: Envio) => void;
  editable: boolean;
}

function PaquetePersonal({ envio, paquete, alCambiar, editable }: PaqueteProps) {
  const avisar = useAviso();
  const [peso, setPeso] = useState(paquete.pesoKg ? String(paquete.pesoKg) : '');
  const [foto, setFoto] = useState<File | null>(null);
  const [mostrarFoto, setMostrarFoto] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const recibirManual = () =>
    hacer(async () => {
      const r = await api.post<{ resultado: string; envioId: string }>('/staff/escaneo', { texto: paquete.tracking });
      if (r.resultado === 'RECIBIDO') {
        alCambiar(await api.get<{ envio: Envio }>(`/envios/${envio.id}`).then((x) => x.envio));
        avisar('Paquete recibido.');
      }
    });

  const guardarPeso = () =>
    hacer(async () => {
      const kilos = aNumero(peso);
      if (!Number.isFinite(kilos) || kilos <= 0) throw new Error('Escribe un peso mayor que cero.');
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${paquete.id}/peso`, { pesoKg: kilos });
      alCambiar(r.envio);
      avisar('Peso guardado.');
    });

  const subirFoto = () =>
    hacer(async () => {
      if (!foto) throw new Error('Toma primero la foto.');
      const formulario = new FormData();
      formulario.set('archivo', foto);
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${paquete.id}/foto`, formulario);
      alCambiar(r.envio);
      setFoto(null);
      setMostrarFoto(false);
      avisar('Foto guardada.');
    });

  const avisarWhatsApp = () =>
    hacer(async () => {
      const mensaje = await pedirMensaje(envio.id, 'llegada', { paqueteId: paquete.id });
      const resultado = await enviarPorWhatsApp(mensaje, paquete.fotoRuta);
      setAbierto(true);
      avisar(resultado === 'foto-copiada' ? 'WhatsApp abierto. La foto está copiada: pégala con Ctrl+V.' : resultado === 'compartido' ? 'Elige el chat del cliente para enviar.' : 'WhatsApp abierto con el mensaje listo.', 'info');
    });

  const confirmarEnviado = () =>
    hacer(async () => {
      const r = await api.post<{ envio: Envio }>(`/staff/paquetes/${paquete.id}/avisado`);
      alCambiar(r.envio);
      setAbierto(false);
      avisar('Aviso registrado.');
    });

  return (
    <li className="rounded-2xl border border-linea p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FiPackage className={paquete.recibido ? 'text-verde' : 'text-suave'} aria-hidden />
          <p className="codigo truncate">{paquete.tracking}</p>
        </div>
        {paquete.recibido ? <span className="insignia bg-verde-100 text-verde">Recibido</span> : <span className="insignia bg-marino-100 text-marino">Esperando</span>}
      </div>

      {!paquete.recibido && editable && (
        <button type="button" className="btn btn-suave btn-chico mt-3" disabled={ocupado} onClick={() => void recibirManual()}>Marcar como recibido</button>
      )}

      {paquete.recibido && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <label htmlFor={`peso-${paquete.id}`} className="etiqueta">Peso (kg)</label>
              <input id={`peso-${paquete.id}`} className="campo" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} disabled={!editable} placeholder="0.00" />
            </div>
            {editable && <button type="button" className="btn btn-primario" disabled={ocupado} onClick={() => void guardarPeso()}>Guardar peso</button>}
          </div>

          <div className="flex flex-wrap gap-2">
            {editable && <button type="button" className="btn btn-suave btn-chico" onClick={() => setMostrarFoto((v) => !v)}><FiCamera aria-hidden /> {paquete.tieneFoto ? 'Cambiar foto' : 'Foto del paquete'}</button>}
            <button type="button" className="btn btn-chico bg-[#25D366] text-marino-900" disabled={ocupado || !paquete.pesoKg} onClick={() => void avisarWhatsApp()}><FaWhatsapp aria-hidden /> Avisar por WhatsApp</button>
            {abierto && <button type="button" className="btn btn-acento btn-chico" onClick={() => void confirmarEnviado()}>Ya lo envié</button>}
            {paquete.avisado && !abierto && <span className="insignia bg-verde-100 text-verde"><FiCheck aria-hidden /> Cliente avisado</span>}
          </div>
          {!paquete.pesoKg && <p className="ayuda">Guarda el peso para poder avisar al cliente.</p>}

          {mostrarFoto && (
            <div className="space-y-3 rounded-2xl bg-papel p-3">
              <FotoInput etiqueta="Foto del paquete" archivo={foto} onChange={setFoto} usarCamara />
              {foto && <button type="button" className="btn btn-primario btn-chico" disabled={ocupado} onClick={() => void subirFoto()}>Guardar foto</button>}
            </div>
          )}
          {paquete.tieneFoto && !mostrarFoto && <ImagenPrivada ruta={paquete.fotoRuta} alt={`Foto del paquete ${paquete.tracking}`} className="h-24 w-24" />}
        </div>
      )}
      {error && <Alerta tono="error" className="mt-3">{error}</Alerta>}
    </li>
  );
}

export function PaquetesPersonal({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const editable = ['PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO'].includes(envio.estado);
  return (
    <ul className="space-y-3">
      {envio.paquetes.map((paquete) => (
        <PaquetePersonal key={paquete.id} envio={envio} paquete={paquete} alCambiar={alCambiar} editable={editable} />
      ))}
    </ul>
  );
}
