import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ActiveEmpresaProvider } from './ActiveEmpresaContext';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';
import Login from './pages/Login';
import Empresas from './pages/Empresas';
import MiEmpresa from './pages/MiEmpresa';
import EmpresaConfig from './pages/EmpresaConfig';
import Apis from './pages/Apis';
import Historial from './pages/Historial';
import Usuarios from './pages/Usuarios';
import ExtensionChrome from './pages/ExtensionChrome';
import ApiCredits from './pages/ApiCredits';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import CambiarPassword from './pages/CambiarPassword';
import Tarifas from './pages/Tarifas';

function RootRedirect() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <Navigate to="/mi-empresa" replace />;
  return <Navigate to="/empresas" replace />;
}

function App() {
  return (
    <AuthProvider>
      <ActiveEmpresaProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cambiar-password" element={<CambiarPassword />} />
            <Route path="/terminos" element={<Terms />} />
            <Route path="/privacidad" element={<Privacy />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<RootRedirect />} />

              {/* SuperAdmin — panel global */}
              <Route path="empresas" element={<Empresas />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="tarifas" element={<Tarifas />} />

              {/* SuperAdmin — vista tenant de empresa */}
              <Route path="empresas/:id" element={<MiEmpresa />} />
              <Route path="empresas/:id/empresa" element={<EmpresaConfig />} />
              <Route path="empresas/:id/apis" element={<Apis />} />
              <Route path="empresas/:id/historial" element={<Historial />} />
              <Route path="empresas/:id/extension" element={<ExtensionChrome />} />
              <Route path="empresas/:id/api-credits" element={<ApiCredits />} />

              {/* Admin Tenant */}
              <Route path="mi-empresa" element={<MiEmpresa />} />
              <Route path="empresa" element={<EmpresaConfig />} />
              <Route path="apis" element={<Apis />} />
              <Route path="historial" element={<Historial />} />
              <Route path="extension" element={<ExtensionChrome />} />
              <Route path="api-credits" element={<ApiCredits />} />
              <Route path="usuarios" element={<Usuarios />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ActiveEmpresaProvider>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
