import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './pages/Admin/Dashboard';
import ApiKeys from './pages/Admin/ApiKeys';
import Issues from './pages/Admin/Issues';
import NewspaperReader from './pages/Reader/NewspaperReader';
import SearchPage from './pages/Search/SearchPage';
import InsightsPage from './pages/Insights/InsightsPage';
import TimelinePage from './pages/Timeline/TimelinePage';
import { useAuth } from './hooks/useAuth';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Layout>
              <Navigate to="/reader" replace />
            </Layout>
          }
        />
        <Route
          path="/reader"
          element={
            <Layout>
              <NewspaperReader />
            </Layout>
          }
        />
        <Route
          path="/reader/:issueId"
          element={
            <Layout>
              <NewspaperReader />
            </Layout>
          }
        />
        <Route
          path="/search"
          element={
            <Layout>
              <SearchPage />
            </Layout>
          }
        />
        <Route
          path="/insights"
          element={
            <Layout>
              <InsightsPage />
            </Layout>
          }
        />
        <Route
          path="/timeline"
          element={
            <Layout>
              <TimelinePage />
            </Layout>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Layout>
                <Navigate to="/admin/dashboard" replace />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/api-keys"
          element={
            <PrivateRoute>
              <Layout>
                <ApiKeys />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/issues"
          element={
            <PrivateRoute>
              <Layout>
                <Issues />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

