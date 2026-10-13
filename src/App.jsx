import { useEffect, useState } from 'react';
import MapContainer from './components/MapContainer.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';

const API_BASE = '';

function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/get-user`, { credentials: 'include' });
        const data = await response.json();
        if (data.isLogin) {
          setUser(data.user);
          setPage('map');
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkLogin();
  }, []);

  if (loading) {
    return <div className="app-loading"><span />正在验证登录状态…</div>;
  }

  if (page === 'login') {
    return (
      <Login
        switchToRegister={() => setPage('register')}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setPage('map');
        }}
      />
    );
  }

  if (page === 'register') {
    return <Register switchToLogin={() => setPage('login')} />;
  }

  if (page === 'map' && user) {
    return (
      <MapContainer
        user={user}
        onLogout={async () => {
          try {
            await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
          } finally {
            setUser(null);
            setPage('login');
          }
        }}
      />
    );
  }

  return null;
}

export default App;
