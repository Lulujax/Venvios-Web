import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alerta, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import type { Envio } from '../../lib/tipos';

export function EntregaDelPerfil({ envio, alCambiar, bloqueado }: { envio: Envio; alCambiar: (envio: Envio) => void; bloqueado: boolean }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const { entrega } = envio;
  const completa = Boolean(entrega.nombre && entrega.agencia && entrega.ciudad && entrega.estado);

  async function actualizar() {
    setActualizando(true);
    setError(null);
    try {
      const respuesta = await api.post<{ envio: Envio }>(`/envios/${envio.id}/entrega/perfil`);
      alCambiar(respuesta.envio);
      avisar('Datos de entrega actualizados con tu perfil.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setActualizando(false);
    }
  }

  return (
    <div className="space-y-4">
      {completa ? (
        <div className="rounded-2xl bg-marino-50 p-4 text-sm">
          <p>Retira: <span className="font-bold">{entrega.nombre}</span></p>
          <p>Agencia: {entrega.agencia} · {entrega.ciudad}, {entrega.estado}</p>
        </div>
      ) : (
        <Alerta tono="aviso">Este envío todavía no tiene datos de entrega. Guárdalos en tu perfil y pulsa «Actualizar con mi perfil».</Alerta>
      )}
      {!bloqueado && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-suave" disabled={actualizando} onClick={() => void actualizar()}>{actualizando ? 'Actualizando…' : 'Actualizar con mi perfil'}</button>
          <Link to="/cuenta/perfil" className="font-bold text-marino underline">Cambiar en mi perfil</Link>
        </div>
      )}
      {!bloqueado && <p className="text-sm text-suave">Si algo más debe cambiar, escríbenos por WhatsApp y lo corregimos.</p>}
      {error && <Alerta tono="error">{error}</Alerta>}
    </div>
  );
}
