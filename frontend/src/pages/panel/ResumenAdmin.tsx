import type { ReactNode } from 'react';
import { Cargando } from '../../components/ui';
import { api } from '../../lib/api';
import type { DatosPago, Usuario } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { contarUsuarios } from '../../lib/usuarios';

interface TasaResumen {
  bolivaresPorUsd: number;
  fecha: string;
  fuente: string;
  desactualizada: boolean;
}

interface EstadisticasUsuarios {
  clientes: number;
  clientesNuevos7Dias: number;
  operadores: number;
  administradores: number;
  total: number;
}

export type Destino = 'usuarios' | 'clientes' | 'tasa' | 'pagos';

function Tarjeta({ titulo, valor, detalle, alerta, destino, alIr }: { titulo: string; valor: ReactNode; detalle: string; alerta?: boolean; destino: Destino; alIr: (destino: Destino) => void }) {
  return (
    <button type="button" onClick={() => alIr(destino)} className={`tarjeta flex w-full flex-col items-start gap-1 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-elevada ${alerta ? 'border-oro ring-2 ring-oro/40' : ''}`}>
      <span className="text-sm font-bold text-suave">{titulo}</span>
      <span className="font-display text-3xl font-bold text-marino-900">{valor}</span>
      <span className={`text-sm ${alerta ? 'font-bold text-marino-900' : 'text-suave'}`}>{detalle}</span>
    </button>
  );
}

export function ResumenAdmin({ alIr }: { alIr: (destino: Destino) => void }) {
  const usuarios = useCarga(() => api.get<{ usuarios: Usuario[] }>('/admin/usuarios').then((r) => r.usuarios));
  const estadisticas = useCarga(() => api.get<EstadisticasUsuarios>('/admin/estadisticas/usuarios'));
  const tasa = useCarga(() => api.get<{ tasa: TasaResumen }>('/admin/tasa').then((r) => r.tasa));
  const pago = useCarga(() => api.get<{ valor: DatosPago }>('/admin/config/datosPago').then((r) => r.valor));

  if (usuarios.cargando || estadisticas.cargando || tasa.cargando || pago.cargando) return <Cargando lineas={2} />;

  const contadores = contarUsuarios(usuarios.datos ?? []);
  const tasaVieja = tasa.datos?.desactualizada ?? false;
  const pagoDePrueba = pago.datos?.esPrueba ?? false;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta titulo="Personal activo" valor={contadores.activos} detalle={`${contadores.operadores} operadores · ${contadores.administradores} administradores`} destino="usuarios" alIr={alIr} />
      <Tarjeta titulo="Clientes registrados" valor={estadisticas.datos ? estadisticas.datos.clientes : '—'} detalle={estadisticas.datos ? `${estadisticas.datos.clientesNuevos7Dias} ${estadisticas.datos.clientesNuevos7Dias === 1 ? 'nuevo' : 'nuevos'} en los últimos 7 días` : 'No se pudo leer el total'} destino="clientes" alIr={alIr} />
      <Tarjeta titulo="Tasa BCV" valor={tasa.datos ? tasa.datos.bolivaresPorUsd.toFixed(2) : '—'} detalle={!tasa.datos ? 'No se pudo leer la tasa' : tasaVieja ? `NO es la de hoy (${tasa.datos.fecha}). Cárgala a mano.` : `${tasa.datos.fecha} · ${tasa.datos.fuente === 'MANUAL' ? 'cargada a mano' : 'de la API'}`} alerta={tasaVieja || !tasa.datos} destino="tasa" alIr={alIr} />
      <Tarjeta titulo="Datos de pago" valor={pagoDePrueba ? 'De prueba' : 'Reales'} detalle={pagoDePrueba ? 'El cliente ve un aviso de prueba. Cárgalos antes de abrir.' : 'Los clientes ven estos datos para pagar'} alerta={pagoDePrueba} destino="pagos" alIr={alIr} />
    </div>
  );
}
