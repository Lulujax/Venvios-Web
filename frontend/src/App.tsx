import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Cargando } from './components/ui';
import { esPersonal, rutaInicial, useAuth } from './lib/auth';
import type { Rol } from './lib/tipos';
import { CambiarClave, Ingresar, Registro } from './pages/Acceso';
import DetalleEnvio from './pages/DetalleEnvio';
import Landing from './pages/Landing';
import NuevaPrealerta from './pages/NuevaPrealerta';
import { Alertas } from './pages/cliente/Alertas';
import { Consolidar } from './pages/cliente/Consolidar';
import { CuentaLayout } from './pages/cliente/Cuenta';
import { Finanzas } from './pages/cliente/Finanzas';
import { Inicio as InicioCuenta } from './pages/cliente/Inicio';
import { Pedidos } from './pages/cliente/Pedidos';
import { Inicio, ListaEnvios, PanelLayout } from './pages/panel/Panel';
import PagosPendientes from './pages/panel/PagosPendientes';

const Administracion = lazy(() => import('./pages/panel/Administracion'));
const Escaneo = lazy(() => import('./pages/panel/Escaneo'));
const Bodega = lazy(() => import('./pages/panel/Bodega'));

function Protegida({ roles }: { roles: Rol[] }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="contenedor py-10"><Cargando /></div>;
  if (!usuario) return <Navigate to="/ingresar" replace />;
  if (usuario.debeCambiarClave) return <Navigate to="/cambiar-clave" replace />;
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
    <div className="grid min-h-[100dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl font-extrabold text-oro">404</p>
        <h1 className="mt-2 text-3xl">No encontramos esa página</h1>
        <a href={usuario && esPersonal(usuario.rol) ? '/panel' : '/'} className="btn btn-primario mt-6">Volver al inicio</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="contenedor py-10"><Cargando /></div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ingresar" element={<Ingresar />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/cambiar-clave" element={<CambiarClave />} />

      <Route element={<Protegida roles={['CLIENTE']} />}>
        <Route path="/cuenta" element={<CuentaLayout />}>
          <Route index element={<InicioCuenta />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="consolidar" element={<Consolidar />} />
          <Route path="finanzas" element={<Finanzas />} />
          <Route path="nuevo" element={<NuevaPrealerta personal={false} />} />
          <Route path="envios/:id" element={<DetalleEnvio personal={false} />} />
        </Route>
      </Route>

      <Route element={<Protegida roles={['OPERADOR', 'ADMIN']} />}>
        <Route path="/panel" element={<PanelLayout />}>
          <Route index element={<Inicio />} />
          <Route path="escanear" element={<Escaneo />} />
          <Route path="bodega" element={<Bodega />} />
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
