import { Link } from 'react-router-dom';
import { Alerta } from '../ui';
import { nombreTransportista } from '../../lib/formato';
import type { PerfilVista, Transportista } from '../../lib/tipos';

export function entregaPerfilCompleta(perfil: PerfilVista | null, transportista: Transportista): boolean {
  return Boolean(perfil?.entrega.completo[transportista]);
}

export function ResumenEntregaPerfil({ perfil, transportista }: { perfil: PerfilVista | null; transportista: Transportista }) {
  if (!perfil) return null;
  const nombre = nombreTransportista(transportista);
  const destino = perfil.entrega.destinos[transportista];
  if (!entregaPerfilCompleta(perfil, transportista) || !destino) {
    return (
      <Alerta tono="aviso">
        <p className="font-bold">Falta tu dirección de entrega de {nombre}.</p>
        <p className="mt-1 text-sm">Guárdala una sola vez en tu perfil y la usamos en todos tus envíos.</p>
        <Link to="/cuenta/perfil" className="btn btn-primario btn-chico mt-3 inline-flex">Completar mi perfil</Link>
      </Alerta>
    );
  }
  const receptor = perfil.entrega.receptor ?? perfil.entrega.receptorPorDefecto;
  return (
    <div className="rounded-2xl border border-linea bg-marino-50 p-4 text-sm" aria-label={`Datos de entrega de ${nombre}`}>
      <p className="font-bold text-marino-900">Entrega en Venezuela por {nombre}</p>
      <p className="mt-1">Retira: {receptor.nombre}</p>
      <p>Agencia: {destino.agencia} · {destino.ciudad}, {destino.estado}</p>
      <Link to="/cuenta/perfil" className="mt-2 inline-block font-bold text-marino underline">Cambiar en mi perfil</Link>
    </div>
  );
}
