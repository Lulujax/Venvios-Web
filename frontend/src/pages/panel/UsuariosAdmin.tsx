import { useState, type FormEvent } from 'react';
import { FiPlus, FiSearch } from 'react-icons/fi';
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
        <Campo etiqueta="Contraseña" type="text" value={nuevo.contrasena} onChange={(e) => setNuevo({ ...nuevo, contrasena: e.target.value })} error={errores.contrasena} ayuda="Désela a la persona. Si quiere otra, la cambia con «¿Olvidaste tu contraseña?»." />
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

function FilaUsuario({ usuario, esYo, alAlternar }: { usuario: Usuario; esYo: boolean; alAlternar: (usuario: Usuario) => void }) {
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
        <button type="button" className={`btn btn-chico shrink-0 ${usuario.activo ? 'btn-suave' : 'btn-primario'}`} onClick={() => alAlternar(usuario)}>{usuario.activo ? 'Desactivar' : 'Activar'}</button>
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
    avisar('Usuario creado. Ya puede entrar por la página del equipo.');
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
        <button type="button" className="btn btn-primario" onClick={() => setCreando(true)}><FiPlus aria-hidden /> Nuevo usuario</button>
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
              <FilaUsuario key={u.id} usuario={u} esYo={u.id === yo?.id} alAlternar={(x) => void alternar(x)} />
            ))}
          </ul>
        </>
      )}

      {creando && (
        <Dialogo titulo="Nuevo usuario del personal" alCerrar={() => setCreando(false)}>
          <FormularioUsuario alCreado={alCrear} alCancelar={() => setCreando(false)} />
        </Dialogo>
      )}
    </div>
  );
}
