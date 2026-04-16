import { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import { auth } from './db/firebase';
import Sidebar from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy loading das páginas para Code Splitting (Fase 4)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Produtos = lazy(() => import('./pages/Produtos'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Testados = lazy(() => import('./pages/Testados'));
const Entregas = lazy(() => import('./pages/Entregas'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const SetupAdmin = lazy(() => import('./pages/SetupAdmin'));
import { Toaster } from 'react-hot-toast';
import { ProductsProvider } from './contexts/ProductsContext';

const ProtectedRoute = ({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: string }) => {
  const { user, loading, isApproved, isAdmin, userStatus, permissions } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  if (userStatus === 'blocked') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Conta Suspensa</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Seu acesso foi bloqueado por um administrador. Por favor, entre em contato com o suporte para mais detalhes.
          </p>
          <button
            onClick={() => auth.signOut()}
            className="text-blue-500 hover:text-blue-400 font-bold transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Aguardando Aprovação</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Seu cadastro foi realizado com sucesso, mas ainda precisa ser aprovado por um administrador para acessar o sistema.
          </p>
          <button
            onClick={() => auth.signOut()}
            className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  if (requiredPermission && !isAdmin) {
    if (!permissions || !(permissions as any)[requiredPermission]) {
      return <Navigate to="/" />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

const LoginRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" /> : <Login />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ProductsProvider>
          <ErrorBoundary>
            <Router>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Carregando aplicação...</p>
                  </div>
                </div>
              }>
                <Routes>
                  <Route path="/login" element={<LoginRoute />} />
                  <Route path="/setup-admin" element={<SetupAdmin />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/produtos" element={<ProtectedRoute><Produtos /></ProtectedRoute>} />
                  <Route path="/inventario" element={<ProtectedRoute requiredPermission="inventory"><Inventario /></ProtectedRoute>} />
                  <Route path="/testados" element={<ProtectedRoute requiredPermission="tested"><Testados /></ProtectedRoute>} />
                  <Route path="/entregas" element={<ProtectedRoute requiredPermission="delivery"><Entregas /></ProtectedRoute>} />
                  <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Suspense>
            </Router>
          </ErrorBoundary>
          <Toaster position="top-right" />
        </ProductsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
