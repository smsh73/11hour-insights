import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const navItems = [
    { path: '/reader', label: '신문 보기' },
    { path: '/search', label: '검색' },
    { path: '/insights', label: '인사이트' },
    { path: '/timeline', label: '타임라인' },
  ];

  const adminItems = [
    { path: '/admin/dashboard', label: '대시보드' },
    { path: '/admin/api-keys', label: 'API 키 관리' },
    { path: '/admin/issues', label: '호수 관리' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'white',
          borderBottom: '1px solid var(--border-color)',
          padding: '1rem 0',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Link
              to="/"
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'var(--primary-color)',
                textDecoration: 'none',
              }}
            >
              11Hour Insights
            </Link>
            <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    textDecoration: 'none',
                    color:
                      location.pathname === item.path
                        ? 'var(--primary-color)'
                        : 'var(--text-color)',
                    fontWeight:
                      location.pathname === item.path ? '600' : '400',
                  }}
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated && (
                <>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  {adminItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      style={{
                        textDecoration: 'none',
                        color:
                          location.pathname === item.path
                            ? 'var(--primary-color)'
                            : 'var(--text-color)',
                        fontWeight:
                          location.pathname === item.path ? '600' : '400',
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={logout}
                    className="btn btn-secondary"
                    style={{ marginLeft: '1rem' }}
                  >
                    로그아웃
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">{children}</div>
      </main>
      <footer
        style={{
          background: 'white',
          borderTop: '1px solid var(--border-color)',
          padding: '1.5rem 0',
          textAlign: 'center',
          color: 'var(--secondary-color)',
        }}
      >
        <div className="container">
          <p>© 2025 안양제일교회 열한시 신문 AI 분석 시스템</p>
        </div>
      </footer>
    </div>
  );
}

