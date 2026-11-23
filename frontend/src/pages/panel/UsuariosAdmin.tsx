import { useState, type FormEvent } from 'react';
import { FiPlus, FiSearch, FiUserCheck } from 'react-icons/fi';
import { Dialogo } from '../../components/Dialogo';
import { useConfirmar } from '../../components/Confirmar';
import { Alerta, Campo, CampoTelefono, Cargando, ErrorCarga, RequisitosContrasenaLista, Vacio, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { crearRegistro } from '../../lib/registro';
import type { Usuario } from '../../lib/tipos';
import { PAIS_PREDETERMINADO, componerTelefono, validarTelefonoLocal } from '../../lib/telefono';
import { FILTROS_INICIALES, contarUsuarios, filtrarUsuarios, type FiltroEstado, type FiltroRol, type FiltrosUsuarios } from '../../lib/usuarios';
import { validarCedula, validarContrasena, validarEmail, validarNombre } from '../../lib/validar';
import { useCarga } from '../../lib/useCarga';

const registro = crearRegistro('admin-usuarios');

const NUEVO_VACIO = { nombre: '', cedula: '', email: '', pais: PAIS_PREDETERMINADO, telefono: '', contrasena: '', rol: 'OPERADOR' };

function FormularioUsuario({ alCreado, alCancelar }: { alCreado: () => Promise<void>; alCancelar: () => void }) {
  const [nuevo, setNuevo] = useState(NUEVO_VACIO);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    const fallos = { nombre: validarNombre(nuevo.nombre) ?? undefined, cedula: validarCedula(nuevo.cedula) ?? undefined, email: validarEmail(nuevo.email) ?? undefined, telefono: validarTelefonoLocal(nuevo.pais, nuevo.telefono) ?? undefined, contrasena: validarContrasena(nuevo.contrasena) ?? undefined };
    setErrores(fallos);
    if (Object.values(fallos).some(Boolean)) {
      registro.warn('Formulario de usuario con datos inválidos', { campos: Object.keys(fallos).filter((c) => fallos[c as keyof typeof fallos]) });
      return;
    }
    setCreando(true);
    setErrorForm(null);
    try {
      await api.post('/admin/usuarios', { nombre: nuevo.nombre, cedula: nuevo.cedula, email: nuevo.email.trim(), telefono: componerTelefono(nuevo.pais, nuevo.telefono), contrasena: nuevo.contrasena, rol: nuevo.rol });
      registro.info('Usuario del personal creado', { rol: nuevo.rol });
      await alCreado();
    } catch (falla) {
      registro.error('No se pudo crear el usuario del personal');
      setErrorForm(mensajeDeError(falla));
      setCreando(false);
    }
  }

  return (
    <form onSubmit={crear} className="space-y-4" noValidate>
      <Campo etiqueta="Nombre y apellido" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} error={errores.nombre} autoFocus />
      <Campo etiqueta="Cédula" inputMode="numeric" value={nuevo.cedula} onChange={(e) => setNuevo({ ...nuevo, cedula: e.target.value })} error={errores.cedula} />
      <Campo etiqueta="Correo electrónico" type="email" autoCapitalize="none" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} error={errores.email} />
      <CampoTelefono etiqueta="Teléfono de WhatsApp" pais={nuevo.pais} numero={nuevo.telefono} alCambiarPais={(pais) => setNuevo({ ...nuevo, pais })} alCambiarNumero={(telefono) => setNuevo({ ...nuevo, telefono })} error={errores.telefono} />
      <div>
        <Campo etiqueta="Contraseña" type="text" value={nuevo.contrasena} onChange={(e) => setNuevo({ ...nuevo, contrasena: e.target.value })} error={errores.contrasena} ayuda="Entrégasela a la persona; puede cambiarla luego con el código por correo." />
        <RequisitosContrasenaLista contrasena={nuevo.contrasena} />
      </div>
      <div>
        <label htmlFor="rol-nuevo" className="etiqueta">Rol</label>
        <select id="rol-nuevo" className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
          <option value="OPERADOR">Operador</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>
      {errorForm && <Alerta tono="error">{errorForm}</Alerta>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-suave" onClick={alCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primario" disabled={creando}>{creando ? 'Creando…' : 'Crear usuario'}</button>
      </div>
    </form>
  );
}

const MINIMO_BUSQUEDA = 3;

function BuscadorClientes({ alElegir, alCancelar }: { alElegir: (cliente: Usuario) => Promise<void>; alCancelar: () => void }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Usuario[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligiendoId, setEligiendoId] = useState<string | null>(null);

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    if (texto.trim().length < MINIMO_BUSQUEDA) {
      setError(`Escribe al menos ${MINIMO_BUSQUEDA} letras o números.`);
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const respuesta = await api.get<{ clientes: Usuario[] }>(`/staff/clientes?q=${encodeURIComponent(texto.trim())}`);
      registro.info('Búsqueda de clientes para volver operador', { encontrados: respuesta.clientes.length });
      setResultados(respuesta.clientes);
    } catch (falla) {
      registro.error('No se pudo buscar clientes');
      setError(mensajeDeError(falla));
    } finally {
      setBuscando(false);
    }
  }

  async function elegir(cliente: Usuario) {
    setEligiendoId(cliente.id);
    try {
      await alElegir(cliente);
    } finally {
      setEligiendoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex gap-2" noValidate>
        <div className="min-w-0 flex-1">
          <label htmlFor="buscar-cliente-rol" className="sr-only">Buscar cliente por nombre, correo, cédula, teléfono o casillero</label>
          <input id="buscar-cliente-rol" type="search" className="campo" placeholder="Nombre, correo, cédula, teléfono o casillero" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        </div>
        <button type="submit" className="btn btn-primario shrink-0" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
      </form>
      {error && <Alerta tono="error">{error}</Alerta>}
      {resultados && resultados.length === 0 && <p className="text-sm text-suave">No hay clientes con esa búsqueda. Si la persona aún no tiene cuenta, usa «Nuevo usuario».</p>}
      {resultados && resultados.length > 0 && (
        <ul className="space-y-2">
          {resultados.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linea bg-white px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-bold">{c.nombre}</p>
                <p className="truncate text-suave">{c.email}</p>
                <p className="codigo text-xs text-suave">{c.codigo}</p>
              </div>
              <button type="button" className="btn btn-primario btn-chico shrink-0" disabled={eligiendoId !== null} onClick={() => void elegir(c)}>{eligiendoId === c.id ? 'Cambiando…' : 'Volver operador'}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <button type="button" className="btn btn-suave" onClick={alCancelar}>Cerrar</button>
      </div>
    </div>
  );
}

function FilaUsuario({ usuario, esYo, alAlternar, alVolverCliente }: { usuario: Usuario; esYo: boolean; alAlternar: (usuario: Usuario) => void; alVolverCliente: (usuario: Usuario) => void }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-2xl border border-linea bg-white px-4 py-3 text-sm ${usuario.activo ? '' : 'opacity-70'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marino-50 font-display text-lg font-bold text-marino-900">{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate font-bold">{usuario.nombre}</p>
          <p className="truncate text-suave">{usuario.email}</p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
            <span className="rounded-full bg-marino-50 px-2 py-0.5 text-marino-900">{usuario.rol === 'ADMIN' ? 'Administrador' : 'Operador'}</span>
            {!usuario.activo && <span className="rounded-full bg-rojo/10 px-2 py-0.5 text-rojo">Inactivo</span>}
            {usuario.activo && usuario.debeCambiarClave && <span className="rounded-full bg-oro-100 px-2 py-0.5 text-marino-900">Pendiente de primer ingreso</span>}
          </p>
        </div>
      </div>
      {esYo ? (
        <span className="shrink-0 text-sm font-bold text-suave">Tú</span>
      ) : (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {usuario.rol === 'OPERADOR' && <button type="button" className="btn btn-chico btn-suave" onClick={() => alVolverCliente(usuario)}>Volver cliente</button>}
          <button type="button" className={`btn btn-chico ${usuario.activo ? 'btn-suave' : 'btn-primario'}`} onClick={() => alAlternar(usuario)}>{usuario.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      )}
    </li>
  );
}

const ESTADOS: Array<{ id: FiltroEstado; texto: string; contador: 'todos' | 'activos' | 'inactivos' | 'pendientes' }> = [
  { id: 'TODOS', texto: 'Todos', contador: 'todos' },
  { id: 'ACTIVOS', texto: 'Activos', contador: 'activos' },
  { id: 'PENDIENTES', texto: 'Sin cambiar clave', contador: 'pendientes' },
  { id: 'INACTIVOS', texto: 'Inactivos', contador: 'inactivos' },
];

export function UsuariosAdmin({ estadoInicial = 'TODOS' }: { estadoInicial?: FiltroEstado }) {
  const { usuario: yo } = useAuth();
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ usuarios: Usuario[] }>('/admin/usuarios').then((r) => r.usuarios));
  const [filtros, setFiltros] = useState<FiltrosUsuarios>({ ...FILTROS_INICIALES, estado: estadoInicial });
  const [creando, setCreando] = useState(false);
  const [promoviendo, setPromoviendo] = useState(false);

  async function cambiarRol(usuario: { id: string; nombre: string }, rol: 'CLIENTE' | 'OPERADOR') {
    try {
      await api.put(`/admin/usuarios/${usuario.id}/rol`, { rol });
      registro.info('Rol de usuario cambiado', { rol });
      await recargar();
      avisar(rol === 'OPERADOR' ? `${usuario.nombre} ahora es operador. Debe volver a iniciar sesión.` : `${usuario.nombre} volvió a ser cliente.`);
    } catch (falla) {
      registro.error('No se pudo cambiar el rol');
      avisar(mensajeDeError(falla), 'error');
    }
  }

  async function volverCliente(usuario: Usuario) {
    const acepto = await confirmar({ titulo: `¿Volver cliente a ${usuario.nombre}?`, pregunta: 'Dejará de entrar al panel de trabajo y su sesión actual se cerrará. Sus paquetes y datos se conservan. Puedes volver a hacerla operadora cuando quieras.', accion: 'Volver cliente', peligro: true });
    if (!acepto) return;
    await cambiarRol(usuario, 'CLIENTE');
  }

  async function volverOperador(cliente: Usuario) {
    await cambiarRol(cliente, 'OPERADOR');
    setPromoviendo(false);
  }

  async function alternar(usuario: Usuario) {
    if (usuario.activo) {
      const acepto = await confirmar({ titulo: `¿Desactivar a ${usuario.nombre}?`, pregunta: 'Dejará de poder entrar al panel. Puedes volver a activarla cuando quieras; sus registros se conservan.', accion: 'Desactivar', peligro: true });
      if (!acepto) return;
    }
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, { activo: !usuario.activo });
      registro.info('Estado de usuario cambiado', { activo: !usuario.activo });
      await recargar();
      avisar(usuario.activo ? 'Usuario desactivado.' : 'Usuario activado.');
    } catch (falla) {
      registro.error('No se pudo cambiar el estado del usuario');
      avisar(mensajeDeError(falla), 'error');
    }
  }

  async function alCrear() {
    setCreando(false);
    await recargar();
    avisar('Usuario creado. Ya puede iniciar sesión.');
  }

  const lista = datos ?? [];
  const contadores = contarUsuarios(lista);
  const visibles = filtrarUsuarios(lista, filtros);
  const hayFiltros = filtros.texto !== '' || filtros.rol !== 'TODOS' || filtros.estado !== 'TODOS';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave" aria-live="polite">
          {datos ? `${contadores.activos} ${contadores.activos === 1 ? 'activo' : 'activos'}: ${contadores.operadores} ${contadores.operadores === 1 ? 'operador' : 'operadores'} y ${contadores.administradores} ${contadores.administradores === 1 ? 'administrador' : 'administradores'}` : 'Cargando personal…'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-suave" onClick={() => setPromoviendo(true)}><FiUserCheck aria-hidden /> Volver operador a un cliente</button>
          <button type="button" className="btn btn-primario" onClick={() => setCreando(true)}><FiPlus aria-hidden /> Nuevo usuario</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <button key={e.id} type="button" aria-pressed={filtros.estado === e.id} onClick={() => setFiltros({ ...filtros, estado: e.id })} className={`btn btn-chico shrink-0 ${filtros.estado === e.id ? 'btn-primario' : 'btn-suave'}`}>
            {e.texto} ({contadores[e.contador]})
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="relative">
          <label htmlFor="buscar-usuario" className="sr-only">Buscar por nombre o correo</label>
          <FiSearch aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-suave" />
          <input id="buscar-usuario" type="search" className="campo pl-11" placeholder="Buscar por nombre o correo" value={filtros.texto} onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })} />
        </div>
        <div>
          <label htmlFor="filtro-rol" className="sr-only">Rol</label>
          <select id="filtro-rol" className="campo" value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value as FiltroRol })}>
            <option value="TODOS">Todos los roles</option>
            <option value="OPERADOR">Operadores</option>
            <option value="ADMIN">Administradores</option>
          </select>
        </div>
      </div>

      {cargando && <Cargando lineas={3} />}
      {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
      {datos && visibles.length === 0 && (
        <Vacio
          titulo={hayFiltros ? 'Nadie coincide con ese filtro' : 'Aún no hay personal'}
          texto={hayFiltros ? 'Prueba con otro nombre o quita los filtros.' : 'Crea el primer usuario para empezar.'}
          accion={hayFiltros ? <button type="button" className="btn btn-suave" onClick={() => setFiltros(FILTROS_INICIALES)}>Quitar filtros</button> : undefined}
        />
      )}
      {visibles.length > 0 && (
        <>
          {hayFiltros && <p className="text-sm text-suave">Mostrando {visibles.length} de {lista.length}.</p>}
          <ul className="grid gap-2 xl:grid-cols-2">
            {visibles.map((u) => (
              <FilaUsuario key={u.id} usuario={u} esYo={u.id === yo?.id} alAlternar={(x) => void alternar(x)} alVolverCliente={(x) => void volverCliente(x)} />
            ))}
          </ul>
        </>
      )}

      {promoviendo && (
        <Dialogo titulo="Volver operador a un cliente" alCerrar={() => setPromoviendo(false)}>
          <BuscadorClientes alElegir={volverOperador} alCancelar={() => setPromoviendo(false)} />
        </Dialogo>
      )}

      {creando && (
        <Dialogo titulo="Nuevo usuario del personal" alCerrar={() => setCreando(false)}>
          <FormularioUsuario alCreado={alCrear} alCancelar={() => setCreando(false)} />
        </Dialogo>
      )}
    </div>
  );
}
