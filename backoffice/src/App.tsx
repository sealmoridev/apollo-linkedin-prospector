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

            <Route path="/" element={<Layout />}>
              <Route index element={<RootRedirect />} />

              {/* SuperAdmin — panel global */}
              <Route path="empresas" element={<Empresas />} />
              <Route path="usuarios" element={<Usuarios />} />

              {/* SuperAdmin — vista tenant de empresa */}
              <Route path="empresas/:id" element={<MiEmpresa />} />
              <Route path="empresas/:id/empresa" element={<EmpresaConfig />} />
              <Route path="empresas/:id/apis" element={<Apis />} />
              <Route path="empresas/:id/historial" element={<Historial />} />
              <Route path="empresas/:id/extension" element={<ExtensionChrome />} />

              {/* Admin Tenant */}
              <Route path="mi-empresa" element={<MiEmpresa />} />
              <Route path="empresa" element={<EmpresaConfig />} />
              <Route path="apis" element={<Apis />} />
              <Route path="historial" element={<Historial />} />
              <Route path="extension" element={<ExtensionChrome />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ActiveEmpresaProvider>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
