import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LayoutPublico } from './components/LayoutPublico';
import { Cargando } from './components/ui';
import { esPersonal, rutaInicial, useAuth } from './lib/auth';
import { rutaEntrada } from './lib/ambito';
import type { Rol } from './lib/tipos';
import { CambiarClave, Ingresar, Registro } from './pages/Acceso';
import DetalleEnvio from './pages/DetalleEnvio';
import Landing from './pages/Landing';
import NuevaPrealerta from './pages/NuevaPrealerta';
import { RecuperarClave } from './pages/RecuperarClave';
import { PRIVACIDAD, TERMINOS } from './pages/legal/contenido';
import { PaginaLegal } from './pages/legal/PaginaLegal';
import { Consolidar } from './pages/cliente/Consolidar';
import { CuentaLayout } from './pages/cliente/Cuenta';
import { Finanzas } from './pages/cliente/Finanzas';
import { Inicio as InicioCuenta } from './pages/cliente/Inicio';
import { MisEnvios } from './pages/cliente/MisEnvios';
import { Rastrear } from './pages/cliente/Rastrear';
import { Perfil } from './pages/cliente/Perfil';
import { Inicio, ListaEnvios, PanelLayout } from './pages/panel/Panel';
import PagosPendientes from './pages/panel/PagosPendientes';

const Administracion = lazy(() => import('./pages/panel/Administracion'));
const Escaneo = lazy(() => import('./pages/panel/Escaneo'));
const Bodega = lazy(() => import('./pages/panel/Bodega'));
const ReporteBodega = lazy(() => import('./pages/panel/ReporteBodega'));

function Protegida({ roles, ambito = 'cliente' }: { roles: Rol[]; ambito?: 'cliente' | 'equipo' }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="contenedor py-10"><Cargando /></div>;
  if (!usuario) return <Navigate to={rutaEntrada(ambito)} replace />;
  if (usuario.debeCambiarClave) return <Navigate to={ambito === 'equipo' ? '/equipo/cambiar-clave' : '/cambiar-clave'} replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to={rutaInicial(usuario)} replace />;
  return <Outlet />;
}

function SoloAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  return usuario?.rol === 'ADMIN' ? <>{children}</> : <Navigate to="/panel" replace />;
}

function NoEncontrada() {
  const { usuario } = useAuth();
  return (
    <LayoutPublico>
      <div className="grid min-h-[70dvh] place-items-center px-6 py-16 text-center">
        <div>
          <p className="font-display text-7xl font-extrabold text-oro">404</p>
          <h1 className="mt-2 text-3xl">No encontramos esa página</h1>
          <a href={usuario && esPersonal(usuario.rol) ? '/panel' : '/'} className="btn btn-primario mt-6">Volver al inicio</a>
        </div>
      </div>
    </LayoutPublico>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="contenedor py-10"><Cargando /></div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ingresar" element={<Ingresar />} />
      <Route path="/equipo" element={<Ingresar equipo />} />
      <Route path="/equipo/recuperar" element={<RecuperarClave equipo />} />
      <Route path="/equipo/cambiar-clave" element={<CambiarClave equipo />} />
      <Route path="/admin" element={<Navigate to="/equipo" replace />} />
      <Route path="/recuperar" element={<RecuperarClave />} />
      <Route path="/admin/recuperar" element={<Navigate to="/equipo/recuperar" replace />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/terminos" element={<PaginaLegal documento={TERMINOS} />} />
      <Route path="/privacidad" element={<PaginaLegal documento={PRIVACIDAD} />} />
      <Route path="/cambiar-clave" element={<CambiarClave />} />

      <Route element={<Protegida roles={['CLIENTE']} />}>
        <Route path="/cuenta" element={<CuentaLayout />}>
          <Route index element={<InicioCuenta />} />
          <Route path="mis-envios" element={<MisEnvios />} />
          <Route path="rastrear" element={<Rastrear />} />
          <Route path="pedidos" element={<Navigate to="/cuenta/mis-envios?pestana=ACTIVOS" replace />} />
          <Route path="alertas" element={<Navigate to="/cuenta/mis-envios?pestana=PREALERTAS" replace />} />
          <Route path="consolidar" element={<Consolidar />} />
          <Route path="finanzas" element={<Finanzas />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="nuevo" element={<NuevaPrealerta personal={false} />} />
          <Route path="envios/:id" element={<DetalleEnvio personal={false} />} />
        </Route>
      </Route>

      <Route element={<Protegida roles={['OPERADOR', 'ADMIN']} ambito="equipo" />}>
        <Route path="/panel" element={<PanelLayout />}>
          <Route index element={<Inicio />} />
          <Route path="escanear" element={<Escaneo />} />
          <Route path="bodega" element={<Bodega />} />
          <Route path="bodega/reporte" element={<ReporteBodega />} />
          <Route path="envios" element={<ListaEnvios />} />
          <Route path="envios/:id" element={<DetalleEnvio personal />} />
          <Route path="pagos" element={<PagosPendientes />} />
          <Route path="nuevo" element={<NuevaPrealerta personal />} />
          <Route path="admin" element={<SoloAdmin><Administracion /></SoloAdmin>} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
    </Suspense>
  );
}
