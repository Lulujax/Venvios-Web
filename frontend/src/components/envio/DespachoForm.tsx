import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheck, FiX } from 'react-icons/fi';
import { FotoInput } from '../FotoInput';
import { Alerta, Campo, ImagenPrivada, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import { nombreTransportista } from '../../lib/formato';
import type { Envio } from '../../lib/tipos';
import { enviarPorWhatsApp, pedirMensaje } from '../../lib/whatsapp';

function faltantesEntrega(envio: Envio): string[] {
  const { entrega } = envio;
  const lista: Array<[string, string | null]> = [['nombre', entrega.nombre], ['cédula', entrega.cedula], ['teléfono', entrega.telefono], ['agencia', entrega.agencia], ['ciudad', entrega.ciudad], ['estado', entrega.estado]];
  return lista.filter(([, valor]) => !valor?.trim()).map(([nombre]) => nombre as string);
}

export function DespachoForm({ envio, alCambiar }: { envio: Envio; alCambiar: (envio: Envio) => void }) {
  const avisar = useAviso();
  const [guia, setGuia] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const faltantes = faltantesEntrega(envio);
  const pagado = envio.estado === 'PAGADO';

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

  const despachar = () =>
    hacer(async () => {
      const numero = guia.trim();
      if (numero.length === 0 && !foto) throw new Error('Sube la foto de la guía o escribe su número.');
      if (numero.length > 0 && numero.length < 3) throw new Error('El número de guía es muy corto. Revísalo o sube solo la foto.');
      const formulario = new FormData();
      if (numero.length > 0) formulario.set('guia', numero);
      if (foto) formulario.set('archivo', foto);
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/despachar`, formulario);
      alCambiar(r.envio);
      avisar('Guía registrada. Ahora envíala al cliente por WhatsApp.');
    });

  const avisarCliente = () =>
    hacer(async () => {
      const mensaje = await pedirMensaje(envio.id, 'despacho');
      const resultado = await enviarPorWhatsApp(mensaje, envio.guia.tieneFoto ? envio.guia.fotoRuta : null);
      avisar(resultado === 'foto-copiada' ? 'WhatsApp abierto. La foto de la guía está copiada: pégala con Ctrl+V.' : resultado === 'compartido' ? 'Elige el chat del cliente para enviar.' : 'WhatsApp abierto con la guía lista.', 'info');
    });

  const cerrar = () =>
    hacer(async () => {
      if (!window.confirm('¿Confirmas que el cliente recibió este envío? Quedará como entregado.')) return;
      const r = await api.post<{ envio: Envio }>(`/staff/envios/${envio.id}/cerrar`);
      alCambiar(r.envio);
      avisar('Envío cerrado como entregado.');
    });

  if (envio.estado === 'DESPACHADO' || envio.estado === 'CERRADO') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-marino-50 p-4">
          <p className="text-sm text-suave">{nombreTransportista(envio.transportista)} · guía</p>
          <p className="codigo text-xl">{envio.guia.numero ?? 'Solo con foto'}</p>
        </div>
        {envio.guia.tieneFoto && <ImagenPrivada ruta={envio.guia.fotoRuta} alt="Foto de la guía" className="max-h-80 w-full object-contain bg-papel sm:w-auto" />}
        {error && <Alerta tono="error">{error}</Alerta>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn bg-[#25D366] text-marino-900" disabled={ocupado} onClick={() => void avisarCliente()}><FaWhatsapp aria-hidden /> Enviar guía por WhatsApp</button>
          {envio.estado === 'DESPACHADO' && <button type="button" className="btn btn-suave" disabled={ocupado} onClick={() => void cerrar()}><FiCheck aria-hidden /> Marcar entregado</button>}
        </div>
      </div>
    );
  }

  if (!pagado) {
    return <Alerta tono="aviso">Este envío no se puede despachar hasta que el pago esté confirmado.</Alerta>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-1 text-sm">
        <li className="flex items-center gap-2 font-semibold text-verde"><FiCheck aria-hidden /> Pago confirmado</li>
        <li className={`flex items-center gap-2 font-semibold ${faltantes.length === 0 ? 'text-verde' : 'text-rojo-700'}`}>
          {faltantes.length === 0 ? <FiCheck aria-hidden /> : <FiX aria-hidden />}
          {faltantes.length === 0 ? 'Datos de entrega completos' : `Faltan datos de entrega: ${faltantes.join(', ')}`}
        </li>
      </ul>
      <p className="text-sm text-suave">Sube la foto de la guía, escribe su número o ambos. Con uno basta.</p>
      <div className="max-w-sm"><FotoInput etiqueta="Foto de la guía" archivo={foto} onChange={setFoto} usarCamara /></div>
      <Campo etiqueta={`Número de guía de ${nombreTransportista(envio.transportista)} (opcional)`} value={guia} onChange={(e) => setGuia(e.target.value)} className="max-w-sm" />
      {error && <Alerta tono="error">{error}</Alerta>}
      <button type="button" className="btn btn-primario" disabled={ocupado || faltantes.length > 0 || (guia.trim().length === 0 && !foto)} onClick={() => void despachar()}>Registrar guía y despachar</button>
    </div>
  );
}
